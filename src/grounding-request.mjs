import { access, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { parseMarkdownFile } from "./frontmatter.mjs";
import { GROUNDING_PROTOCOL_VERSION } from "./protocol.mjs";

const SUPPORTED_INTEGRATIONS = new Set(["auto", "openspec"]);
const AFFECTS_DOMAIN_FIELDS = ["concepts", "rules", "lifecycles", "events"];

export async function buildGroundingRequest(inputPath, options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const integration = options.integration ?? "auto";

  if (!SUPPORTED_INTEGRATIONS.has(integration)) {
    return {
      request: null,
      errors: [
        issue({
          file: "<input>",
          field: "integration",
          problem: `Unsupported integration '${integration}'.`,
          fix: "Use --integration openspec or omit --integration for auto-detection."
        })
      ]
    };
  }

  return buildOpenSpecGroundingRequest(inputPath, cwd, integration);
}

export function collectAffectedIds(affectsDomain) {
  const ids = [];
  for (const field of AFFECTS_DOMAIN_FIELDS) {
    const values = Array.isArray(affectsDomain?.[field]) ? affectsDomain[field] : [];
    values.forEach((id, index) => {
      ids.push({
        id,
        field: `affects_domain.${field}[${index}]`
      });
    });
  }
  return ids;
}

async function buildOpenSpecGroundingRequest(inputPath, cwd, selectedIntegration) {
  if (!inputPath) {
    return {
      request: null,
      errors: [
        issue({
          file: "<input>",
          field: "$",
          problem: "Missing feature spec path.",
          fix: "Run opendomain prepare <feature-spec-or-dir>."
        })
      ]
    };
  }

  const absoluteInput = path.resolve(cwd, inputPath);
  if (!await exists(absoluteInput)) {
    return {
      request: null,
      errors: [
        issue({
          file: inputPath,
          field: "$",
          problem: "Feature spec path does not exist.",
          fix: "Pass an existing feature spec file or directory."
        })
      ]
    };
  }

  const files = (await stat(absoluteInput)).isDirectory()
    ? await walkMarkdown(absoluteInput)
    : [absoluteInput];

  const featureSpecs = [];
  const parseErrors = [];
  for (const file of files) {
    try {
      const parsed = await parseMarkdownFile(file);
      if (parsed.frontmatter.type === "feature_spec") {
        featureSpecs.push({
          sourceFile: path.relative(cwd, file) || path.basename(file),
          id: parsed.frontmatter.id,
          frontmatter: parsed.frontmatter,
          body: parsed.body
        });
      }
    } catch (error) {
      parseErrors.push(issue({
        file: path.relative(cwd, file) || file,
        field: error.field ?? "$",
        problem: error.problem ?? error.message,
        fix: "Use valid feature spec front matter."
      }));
    }
  }

  if (featureSpecs.length === 0) {
    return {
      request: null,
      errors: parseErrors.length > 0 ? parseErrors : [
        issue({
          file: inputPath,
          field: "type",
          problem: "No feature_spec found.",
          fix: "Pass a Markdown feature spec with type: feature_spec."
        })
      ]
    };
  }

  if (featureSpecs.length > 1) {
    return {
      request: null,
      errors: [
        issue({
          file: inputPath,
          field: "type",
          problem: "Multiple feature_spec files found.",
          fix: "Pass a single feature spec file for deterministic grounding."
        })
      ]
    };
  }

  const feature = featureSpecs[0];
  if (
    !feature.frontmatter.affects_domain
    || typeof feature.frontmatter.affects_domain !== "object"
    || Array.isArray(feature.frontmatter.affects_domain)
  ) {
    return {
      request: null,
      errors: [
        issue({
          file: feature.sourceFile,
          field: "affects_domain",
          problem: "Feature spec is missing affects_domain.",
          fix: "Declare affected OpenDomain concepts, rules, lifecycles, or events."
        })
      ]
    };
  }

  const requestErrors = validateRequestFields(feature);
  if (requestErrors.length > 0) {
    return {
      request: null,
      errors: requestErrors
    };
  }

  return {
    request: {
      protocol_version: GROUNDING_PROTOCOL_VERSION,
      source: {
        type: "openspec",
        path: feature.sourceFile
      },
      integration: {
        id: "openspec",
        kind: "builtin",
        selected: selectedIntegration
      },
      intent: {
        id: feature.id,
        name: feature.frontmatter.name,
        status: feature.frontmatter.status
      },
      affects_domain: normalizeAffectsDomain(feature.frontmatter.affects_domain)
    },
    errors: []
  };
}

function normalizeAffectsDomain(affectsDomain) {
  const normalized = {};
  for (const field of AFFECTS_DOMAIN_FIELDS) {
    normalized[field] = Array.isArray(affectsDomain[field])
      ? [...new Set(affectsDomain[field])]
      : [];
  }
  return normalized;
}

function validateRequestFields(feature) {
  const errors = [];
  for (const field of ["id", "name", "status"]) {
    if (typeof feature.frontmatter[field] !== "string" || !feature.frontmatter[field].trim()) {
      errors.push(issue({
        file: feature.sourceFile,
        field,
        problem: `Feature spec '${field}' must be a non-empty string.`,
        fix: `Add a non-empty ${field} value to feature spec front matter.`
      }));
    }
  }

  for (const field of AFFECTS_DOMAIN_FIELDS) {
    const values = feature.frontmatter.affects_domain[field];
    if (values !== undefined && !Array.isArray(values)) {
      errors.push(issue({
        file: feature.sourceFile,
        field: `affects_domain.${field}`,
        problem: `Feature spec affects_domain.${field} must be an array.`,
        fix: `Use a YAML list of OpenDomain IDs for affects_domain.${field}.`
      }));
      continue;
    }
    for (const [index, id] of (values ?? []).entries()) {
      if (typeof id !== "string" || !id.trim()) {
        errors.push(issue({
          file: feature.sourceFile,
          field: `affects_domain.${field}[${index}]`,
          problem: "Affected OpenDomain ID must be a non-empty string.",
          fix: "Use a stable OpenDomain ID or remove the invalid list item."
        }));
      }
    }
  }

  return errors;
}

function issue(issueFields) {
  return {
    severity: issueFields.severity ?? "error",
    file: issueFields.file,
    field: issueFields.field,
    problem: issueFields.problem,
    fix: issueFields.fix
  };
}

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function walkMarkdown(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walkMarkdown(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(fullPath);
    }
  }
  return files.sort();
}
