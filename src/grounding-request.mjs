import { access, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { parseMarkdownFile } from "./frontmatter.mjs";
import { buildProfileGroundingRequest } from "./profile-mapping.mjs";
import { loadIntegrationProfiles } from "./profile-registry.mjs";
import { GROUNDING_PROTOCOL_VERSION } from "./protocol.mjs";
import {
  findMatchingProfileSourceUnits,
  resolveProfileSourceUnit
} from "./source-unit.mjs";

const SUPPORTED_INTEGRATIONS = new Set(["auto", "openspec"]);
const AFFECTS_DOMAIN_FIELDS = ["concepts", "rules", "lifecycles", "events"];

export async function buildGroundingRequest(inputPath, options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const integrationProvided = options.integration !== undefined && options.integration !== null;
  const profileProvided = options.profile !== undefined && options.profile !== null;
  const integration = options.integration ?? "auto";

  if (integrationProvided && profileProvided) {
    return failedRequest(issue({
      file: "<input>",
      field: "integration",
      problem: "--integration and --profile cannot be used together.",
      fix: "Select the built-in adapter with --integration openspec, or one local Profile with --profile <id>."
    }));
  }

  if (profileProvided) {
    if (typeof options.profile !== "string" || !options.profile.trim()) {
      return failedRequest(issue({
        file: "<input>",
        field: "profile",
        problem: "Missing Integration Profile ID.",
        fix: "Run opendomain prepare --profile <id> <structured-file-or-bundle>."
      }));
    }
    return buildSelectedProfileGroundingRequest(inputPath, options.profile, cwd);
  }

  if (!SUPPORTED_INTEGRATIONS.has(integration)) {
    return failedRequest(issue({
      file: "<input>",
      field: "integration",
      problem: `Unsupported integration '${integration}'.`,
      fix: "Use --integration openspec, --profile <id>, or omit selection for auto-detection."
    }));
  }

  if (integration === "openspec") {
    return buildOpenSpecGroundingRequest(inputPath, cwd, integration);
  }

  return buildAutomaticGroundingRequest(inputPath, cwd);
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

export async function buildOpenSpecGroundingRequest(inputPath, cwd, selectedIntegration = "openspec") {
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
      ],
      warnings: []
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
      ],
      warnings: []
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
      ],
      warnings: []
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
      ],
      warnings: []
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
      ],
      warnings: []
    };
  }

  const requestErrors = validateRequestFields(feature);
  if (requestErrors.length > 0) {
    return {
      request: null,
      errors: requestErrors,
      warnings: []
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
    errors: [],
    warnings: []
  };
}

async function buildAutomaticGroundingRequest(inputPath, cwd) {
  const openSpecResult = await buildOpenSpecGroundingRequest(inputPath, cwd, "auto");
  const registry = await loadIntegrationProfiles({
    cwd,
    allowMissingWorkspace: true
  });
  if (registry.errors.length > 0) {
    return {
      request: null,
      errors: registry.errors,
      warnings: registry.warnings
    };
  }

  if (registry.profiles.length === 0) {
    return {
      ...openSpecResult,
      warnings: [...(openSpecResult.warnings ?? []), ...registry.warnings]
    };
  }

  const matchResult = await findMatchingProfileSourceUnits(
    registry.profiles,
    inputPath,
    {
      cwd,
      outsideWorkspaceIsNoMatch: true
    }
  );
  if (matchResult.errors.length > 0) {
    return {
      request: null,
      errors: matchResult.errors,
      warnings: registry.warnings
    };
  }

  const candidates = [
    ...(openSpecResult.request
      ? [{
          id: "openspec",
          kind: "builtin",
          requestResult: openSpecResult
        }]
      : []),
    ...matchResult.matches.map((match) => ({
      id: match.entry.id,
      kind: "profile",
      match
    }))
  ];

  if (candidates.length === 0) {
    return {
      ...openSpecResult,
      warnings: [...(openSpecResult.warnings ?? []), ...registry.warnings]
    };
  }

  if (candidates.length > 1) {
    return {
      request: null,
      errors: [issue({
        file: inputPath ?? "<input>",
        field: "integration",
        problem: `Multiple integrations match this input: ${candidates.map((candidate) => candidate.id).sort().join(", ")}.`,
        fix: "Narrow Profile path patterns, or select one integration explicitly with --profile <id> or --integration openspec."
      })],
      warnings: registry.warnings
    };
  }

  const selected = candidates[0];
  if (selected.kind === "builtin") {
    return {
      ...selected.requestResult,
      warnings: [
        ...(selected.requestResult.warnings ?? []),
        ...registry.warnings
      ]
    };
  }

  if (selected.match.errors.length > 0) {
    return {
      request: null,
      errors: selected.match.errors,
      warnings: registry.warnings
    };
  }

  const result = await buildProfileGroundingRequest(
    selected.match.entry,
    selected.match.sourceUnit,
    { selected: "auto" }
  );
  return {
    ...result,
    warnings: [...(result.warnings ?? []), ...registry.warnings]
  };
}

async function buildSelectedProfileGroundingRequest(inputPath, profileId, cwd) {
  const registry = await loadIntegrationProfiles({ cwd });
  if (registry.errors.length > 0) {
    return {
      request: null,
      errors: registry.errors,
      warnings: registry.warnings
    };
  }

  const entry = registry.profiles.find((profile) => profile.id === profileId);
  if (!entry) {
    return {
      request: null,
      errors: [issue({
        file: registry.profile_directory ?? "<workspace>",
        field: "profile",
        problem: `Integration Profile '${profileId}' was not found.`,
        fix: "Run 'opendomain integrations list' and select an available repository-local Profile ID."
      })],
      warnings: registry.warnings
    };
  }

  const resolution = await resolveProfileSourceUnit(entry, inputPath, { cwd });
  if (resolution.errors.length > 0) {
    return {
      request: null,
      errors: resolution.errors,
      warnings: registry.warnings
    };
  }
  if (!resolution.matched) {
    return {
      request: null,
      errors: [issue({
        file: inputPath ?? "<input>",
        field: "profile",
        problem: `Input does not match Integration Profile '${profileId}'.`,
        fix: "Pass a file or bundle matched by the Profile, or select a different Profile ID."
      })],
      warnings: registry.warnings
    };
  }

  const result = await buildProfileGroundingRequest(entry, resolution.sourceUnit, {
    selected: "explicit"
  });
  return {
    ...result,
    warnings: [...(result.warnings ?? []), ...registry.warnings]
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

function failedRequest(error) {
  return {
    request: null,
    errors: [error],
    warnings: []
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
