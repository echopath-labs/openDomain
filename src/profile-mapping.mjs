import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  parseJsonMapping,
  parseMarkdownFile,
  parseYamlMapping
} from "./frontmatter.mjs";
import { validateIntegrationValue } from "./integration-schema-validator.mjs";
import { GROUNDING_PROTOCOL_VERSION } from "./protocol.mjs";
import { publicSourceUnit } from "./source-unit.mjs";

const AFFECTS_DOMAIN_FIELDS = ["concepts", "rules", "lifecycles", "events"];

export async function buildProfileGroundingRequest(entry, sourceUnit, options = {}) {
  const memberData = new Map();
  const errors = [];

  for (const member of sourceUnit.members) {
    const result = await readStructuredMember(member);
    errors.push(...result.errors);
    if (result.value) {
      memberData.set(member.role, result.value);
    }
  }
  if (errors.length > 0) {
    return {
      request: null,
      errors: errors.sort(compareIssues),
      warnings: []
    };
  }

  const intent = {};
  for (const field of ["id", "name", "status"]) {
    const selector = entry.profile.intent[field];
    const selected = evaluateSelector(selector, memberData);
    const value = selected.found ? selected.value : selector.default;
    if (typeof value !== "string" || !value.trim()) {
      errors.push(issue({
        file: entry.sourceFile,
        field: `intent.${field}`,
        problem: `Profile could not produce a non-empty string for intent.${field}.`,
        fix: `Map intent.${field} from a structured member field or provide an intent-only default.`
      }));
      continue;
    }
    intent[field] = value;
  }

  const referenceResult = entry.profile.references.mode === "native"
    ? normalizeNativeReferences(entry, memberData)
    : normalizeSidecarReferences(entry, sourceUnit, memberData);
  errors.push(...referenceResult.errors);

  if (errors.length > 0) {
    return {
      request: null,
      errors: errors.sort(compareIssues),
      warnings: []
    };
  }

  const request = {
    protocol_version: GROUNDING_PROTOCOL_VERSION,
    source: {
      type: entry.profile.source_type,
      path: sourceUnit.root_path
    },
    integration: {
      id: entry.id,
      kind: "profile",
      selected: options.selected ?? "explicit",
      profile_file: entry.sourceFile,
      source_unit: publicSourceUnit(sourceUnit)
    },
    intent,
    affects_domain: referenceResult.affectsDomain
  };

  const requestIssues = validateIntegrationValue("request", request).map((schemaIssue) => ({
    ...schemaIssue,
    file: sourceUnit.root_path
  }));
  if (requestIssues.length > 0) {
    return {
      request: null,
      errors: requestIssues,
      warnings: []
    };
  }

  return {
    request,
    errors: [],
    warnings: []
  };
}

async function readStructuredMember(member) {
  const extension = path.extname(member.absolutePath).toLowerCase();
  try {
    if (extension === ".md") {
      const parsed = await parseMarkdownFile(member.absolutePath);
      return {
        value: parsed.frontmatter,
        errors: []
      };
    }
    if (extension === ".yaml" || extension === ".yml") {
      return {
        value: parseYamlMapping(
          await readFile(member.absolutePath, "utf8"),
          member.path,
          { label: "Structured YAML member" }
        ),
        errors: []
      };
    }
    if (extension === ".json") {
      return {
        value: parseJsonMapping(
          await readFile(member.absolutePath, "utf8"),
          member.path
        ),
        errors: []
      };
    }
  } catch (error) {
    return {
      value: null,
      errors: [issue({
        file: member.path,
        field: error.field ?? "$",
        problem: error.problem ?? error.message,
        fix: "Use safe structured Markdown front matter, YAML, or JSON."
      })]
    };
  }

  return {
    value: null,
    errors: [issue({
      file: member.path,
      problem: `Unsupported structured member extension '${extension || "<none>"}'.`,
      fix: "Use a .md, .yaml, .yml, or .json member."
    })]
  };
}

function normalizeNativeReferences(entry, memberData) {
  const affectsDomain = emptyAffectsDomain();
  const errors = [];

  for (const field of AFFECTS_DOMAIN_FIELDS) {
    const selector = entry.profile.references.affects_domain[field];
    if (!selector) {
      continue;
    }

    const selected = evaluateSelector(selector, memberData);
    if (!selected.found) {
      continue;
    }

    let values = selected.value;
    if (selector.coerce === "array" && typeof values === "string") {
      values = [values];
    }
    if (!Array.isArray(values)) {
      errors.push(issue({
        file: entry.sourceFile,
        field: `references.affects_domain.${field}`,
        problem: `Native Mapping for affects_domain.${field} did not produce an array.`,
        fix: "Map an explicit string array, or add coerce: array for a scalar string."
      }));
      continue;
    }

    const normalized = [];
    const seen = new Set();
    values.forEach((id, index) => {
      if (typeof id !== "string" || !id.trim()) {
        errors.push(issue({
          file: entry.sourceFile,
          field: `references.affects_domain.${field}[${index}]`,
          problem: "Native Mapping produced an OpenDomain ID that is not a non-empty string.",
          fix: "Store explicit non-empty OpenDomain IDs in the selected structured source field."
        }));
        return;
      }
      if (!seen.has(id)) {
        seen.add(id);
        normalized.push(id);
      }
    });
    affectsDomain[field] = normalized;
  }

  if (
    errors.length === 0
    && AFFECTS_DOMAIN_FIELDS.every((field) => affectsDomain[field].length === 0)
  ) {
    errors.push(issue({
      file: entry.sourceFile,
      field: "references.affects_domain",
      problem: "Native Mapping produced no explicit OpenDomain references.",
      fix: "Map at least one concept, rule, lifecycle, or event ID from structured source data."
    }));
  }

  return {
    affectsDomain,
    errors
  };
}

function normalizeSidecarReferences(entry, sourceUnit, memberData) {
  const declarationMember = sourceUnit.members.find((member) => member.role === "declaration");
  const declaration = memberData.get("declaration");

  if (!declarationMember || !declaration) {
    return {
      affectsDomain: emptyAffectsDomain(),
      errors: [issue({
        file: entry.sourceFile,
        field: "references.mode",
        problem: "Sidecar mode could not read its required declaration member.",
        fix: "Configure and create one safe structured declaration member inside the bundle."
      })]
    };
  }

  const schemaIssues = validateIntegrationValue("declaration", declaration).map((schemaIssue) => ({
    ...schemaIssue,
    file: declarationMember.path
  }));
  if (schemaIssues.length > 0) {
    return {
      affectsDomain: emptyAffectsDomain(),
      errors: schemaIssues
    };
  }

  return {
    affectsDomain: Object.fromEntries(
      AFFECTS_DOMAIN_FIELDS.map((field) => [
        field,
        [...declaration.affects_domain[field]]
      ])
    ),
    errors: []
  };
}

function evaluateSelector(selector, memberData) {
  const fieldPaths = selector.from ? [selector.from] : selector.first_of;
  for (const fieldPath of fieldPaths) {
    const segments = fieldPath.split(".");
    const role = segments.shift();
    let value = memberData.get(role);
    if (value === undefined) {
      continue;
    }

    let found = true;
    for (const segment of segments) {
      if (
        value === null
        || typeof value !== "object"
        || Array.isArray(value)
        || !Object.hasOwn(value, segment)
      ) {
        found = false;
        break;
      }
      value = value[segment];
    }
    if (found && value !== undefined && value !== null) {
      return {
        found: true,
        value,
        fieldPath
      };
    }
  }

  return {
    found: false,
    value: undefined,
    fieldPath: null
  };
}

function emptyAffectsDomain() {
  return {
    concepts: [],
    rules: [],
    lifecycles: [],
    events: []
  };
}

function issue(fields) {
  return {
    severity: fields.severity ?? "error",
    file: fields.file,
    field: fields.field ?? "$",
    problem: fields.problem,
    fix: fields.fix
  };
}

function compareIssues(left, right) {
  return compareText(left.file, right.file)
    || compareText(left.field, right.field)
    || compareText(left.problem, right.problem);
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}
