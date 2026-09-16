import { access, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import {
  AFFECTS_DOMAIN_FIELDS,
  AFFECTS_DOMAIN_TYPES,
  validateAffectsDomainShape
} from "./domain-reference-types.mjs";
import { parseJsonMapping, parseMarkdown, parseYamlMapping } from "./frontmatter.mjs";
import { validateGroundingDecision } from "./grounding-decision.mjs";
import { validateIntegrationValue } from "./integration-schema-validator.mjs";
import { buildProfileGroundingRequest } from "./profile-mapping.mjs";
import { loadIntegrationProfiles } from "./profile-registry.mjs";
import { GROUNDING_PROTOCOL_VERSION } from "./protocol.mjs";
import {
  findMatchingProfileSourceUnits,
  resolveProfileSourceUnit
} from "./source-unit.mjs";

const SUPPORTED_INTEGRATIONS = new Set(["auto", "openspec"]);
const NATIVE_REQUEST_EXAMPLE = JSON.stringify({
  protocol_version: GROUNDING_PROTOCOL_VERSION,
  source: { type: "agent", path: "work.md" },
  intent: { id: "work.review", name: "Review work", status: "proposed" },
  grounding: { status: "unclassified" },
  affects_domain: { concepts: [], rules: [], lifecycles: [], events: [] }
});
const NATIVE_REQUEST_FIX = [
  "Provide one OpenDomain Grounding Request v1 JSON/YAML file and run opendomain assure --request <file> (or prepare --request <file>).",
  `Minimal JSON: ${NATIVE_REQUEST_EXAMPLE}.`,
  "Classify the work explicitly and reference existing accepted IDs; do not add metadata to every planning document."
].join(" ");

export async function buildGroundingRequest(inputPath, options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const integrationProvided = options.integration !== undefined && options.integration !== null;
  const profileProvided = options.profile !== undefined && options.profile !== null;
  const integration = options.integration ?? "auto";

  if (options.request) {
    if (integrationProvided || profileProvided) {
      return failedRequest(issue({
        file: "<input>", field: "request", code: "conflicting_request_input",
        problem: "--request cannot be combined with --integration or --profile.",
        fix: "Select one native request file with --request, or one legacy source input."
      }));
    }
    return buildNativeGroundingRequest(inputPath, cwd);
  }

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

async function buildNativeGroundingRequest(inputPath, cwd) {
  let value;
  try {
    if (!inputPath) throw new Error("Missing native Grounding Request file.");
    const file = path.resolve(cwd, inputPath);
    const extension = path.extname(file).toLowerCase();
    if (![".json", ".yaml", ".yml"].includes(extension)) {
      throw new Error("Native Grounding Requests must use a .json, .yaml or .yml file.");
    }
    if (!(await stat(file)).isFile()) throw new Error("Native Grounding Request input must be one file.");
    const content = await readFile(file, "utf8");
    value = extension === ".json"
      ? parseJsonMapping(content, inputPath)
      : parseYamlMapping(content, inputPath, { label: "Grounding Request" });
  } catch (error) {
    return failedRequest(issue({
      code: "invalid_grounding_request", file: inputPath ?? "<input>",
      field: error.field ?? "$", problem: error.problem ?? error.message,
      fix: NATIVE_REQUEST_FIX
    }));
  }

  const errors = validateIntegrationValue("request", value).map((error) => issue({
    ...error, code: "invalid_grounding_request", file: inputPath
  }));
  if (errors.length > 0) return { request: null, errors, warnings: [] };

  const fieldErrors = validateRequestFields({
    sourceFile: inputPath,
    frontmatter: { ...value.intent, affects_domain: value.affects_domain }
  });
  if (fieldErrors.length > 0) {
    return { request: null, errors: fieldErrors, warnings: [] };
  }

  const decision = validateGroundingDecision(value, inputPath);
  if (decision.errors.length > 0) {
    return { request: null, errors: decision.errors, warnings: decision.warnings };
  }
  // Only declarations enter preparation. Caller-supplied output/provenance is not evidence.
  return {
    request: {
      protocol_version: value.protocol_version,
      source: { type: value.source.type, path: value.source.path },
      intent: { id: value.intent.id, name: value.intent.name, status: value.intent.status },
      grounding: decision.grounding,
      affects_domain: normalizeAffectsDomain(value.affects_domain)
    },
    errors: [],
    warnings: decision.warnings
  };
}

export function collectAffectedIds(affectsDomain) {
  const ids = [];
  for (const field of AFFECTS_DOMAIN_FIELDS) {
    const values = Array.isArray(affectsDomain?.[field]) ? affectsDomain[field] : [];
    values.forEach((id, index) => {
      ids.push({
        id,
        field: `affects_domain.${field}[${index}]`,
        expectedType: AFFECTS_DOMAIN_TYPES[field]
      });
    });
  }
  return ids;
}

export async function buildOpenSpecGroundingRequest(inputPath, cwd, selectedIntegration = "openspec") {
  if (!inputPath) {
    return {
      matched: false,
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
      matched: false,
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
      const content = await readFile(file, "utf8");
      // Plain planning prose is not an OpenDomain declaration. Do not demand metadata on it.
      if (!/^\uFEFF?---(?:\r?\n|$)/.test(content)) continue;
      const parsed = parseMarkdown(content, file);
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
        code: "invalid_grounding_declaration",
        file: path.relative(cwd, file) || file,
        field: error.field ?? "$",
        problem: error.problem ?? error.message,
        fix: "Repair the malformed declaration header, or select one valid declaration file explicitly. " + NATIVE_REQUEST_FIX
      }));
    }
  }

  if (parseErrors.length > 0) {
    return { matched: true, request: null, errors: parseErrors, warnings: [] };
  }

  if (featureSpecs.length === 0) {
    return {
      matched: false,
      request: null,
      errors: [
        issue({
          code: "missing_grounding_declaration",
          file: inputPath,
          field: "type",
          problem: "No OpenDomain grounding declaration found. The input did not produce a Grounding Request; the domain model has not been checked.",
          fix: NATIVE_REQUEST_FIX
        })
      ],
      warnings: []
    };
  }

  if (featureSpecs.length > 1) {
    return {
      matched: true,
      request: null,
      errors: [
        issue({
          code: "ambiguous_grounding_declaration",
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

  const groundingDecision = validateGroundingDecision(
    feature.frontmatter,
    feature.sourceFile
  );
  const requestErrors = [
    ...validateRequestFields(feature),
    ...groundingDecision.errors
  ];
  if (requestErrors.length > 0) {
    return {
      matched: true,
      request: null,
      errors: requestErrors,
      warnings: groundingDecision.warnings
    };
  }

  return {
    matched: true,
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
      grounding: groundingDecision.grounding,
      affects_domain: normalizeAffectsDomain(feature.frontmatter.affects_domain)
    },
    errors: [],
    warnings: groundingDecision.warnings
  };
}

async function buildAutomaticGroundingRequest(inputPath, cwd) {
  const openSpecResult = await buildOpenSpecGroundingRequest(inputPath, cwd, "auto");
  if (openSpecResult.matched && openSpecResult.errors.length > 0) {
    return openSpecResult;
  }
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
        code: "ambiguous_integration",
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
  const errors = validateAffectsDomainShape(
    feature.frontmatter.affects_domain,
    feature.sourceFile
  );
  for (const field of ["id", "name", "status"]) {
    if (typeof feature.frontmatter[field] !== "string" || !feature.frontmatter[field].trim()) {
      errors.push(issue({
        file: feature.sourceFile,
        field,
        problem: `Grounding declaration '${field}' must be a non-empty string.`,
        fix: `Provide a non-empty ${field} value in the work intent declaration.`
      }));
    }
  }

  return errors;
}

function issue(issueFields) {
  return {
    ...(issueFields.code ? { code: issueFields.code } : {}),
    severity: issueFields.severity ?? "error",
    file: issueFields.file,
    field: issueFields.field,
    problem: inlineDiagnostic(issueFields.problem),
    fix: inlineDiagnostic(issueFields.fix)
  };
}

function inlineDiagnostic(value) {
  return value.replace(/[\u0000-\u001F\u007F]/g, (character) => (
    `\\u${character.codePointAt(0).toString(16).padStart(4, "0")}`
  ));
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
