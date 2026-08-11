import {
  buildSemanticIndexFromValidation
} from "./indexer.mjs";
import { assertContextExportEnvelope } from "./context-export-schema.mjs";
import { selectSemanticContext } from "./semantic-query.mjs";
import { validatePath } from "./validator.mjs";

export const CORE_API_VERSION = "1.0";
export const CONTEXT_QUERY_SCHEMA = "opendomain.context-query.v1";
export const CONTEXT_EXPORT_SCHEMA = "opendomain.context-export.v1";

const SOURCE_AUTHORITY = "OpenDomain Markdown source files and a validated governance manifest when present";

export async function validateWorkspace(request = {}) {
  const normalized = normalizeCommonRequest(request);
  if (normalized.errors.length > 0) {
    return {
      documents: [],
      errors: normalized.errors,
      warnings: [],
      workspace: null,
      governance: null
    };
  }
  return validatePath(normalized.target, {
    cwd: normalized.cwd,
    now: normalized.now
  });
}

export async function queryWorkspace(request = {}) {
  const normalized = normalizeCommonRequest(request);
  const generatedAt = normalized.now.toISOString();
  if (normalized.errors.length > 0) {
    return portableResult(emptyQueryResult(normalized, generatedAt, normalized.errors));
  }

  const snapshot = await createSnapshot(normalized);
  if (snapshot.errors.length > 0) {
    return portableResult(emptyQueryResult(
      normalized,
      generatedAt,
      snapshot.errors,
      snapshot.warnings,
      snapshot.validation?.workspace ?? null,
      snapshot.validation?.governance ?? null
    ));
  }

  const selection = selectSemanticContext(snapshot.index, request.selector);
  return portableResult({
    schema: CONTEXT_QUERY_SCHEMA,
    api_version: CORE_API_VERSION,
    status: selection.errors.length === 0 ? "pass" : "fail",
    generated_at: generatedAt,
    request: {
      target: normalized.target ?? null,
      selector: selection.selector
    },
    source: sourceDescriptor(snapshot.validation.workspace),
    governance: governanceForEntries(snapshot.validation.governance, selection.entries, null),
    semantic_closure: selection.semantic_closure,
    read_first: selection.read_first,
    accepted_ids: selection.accepted_ids,
    candidate_boundaries: selection.candidate_boundaries,
    verify_with: selection.verify_with,
    warnings: [...snapshot.warnings, ...selection.warnings],
    errors: selection.errors
  });
}

export async function exportContext(request = {}) {
  const normalized = normalizeCommonRequest(request);
  const generatedAt = normalized.now.toISOString();
  const exposureErrors = validateExposure(request.exposure);
  const initialErrors = [...normalized.errors, ...exposureErrors];
  if (initialErrors.length > 0) {
    return finalizeExport(emptyExportResult(normalized, generatedAt, initialErrors, request));
  }

  const snapshot = await createSnapshot(normalized);
  if (snapshot.errors.length > 0) {
    return finalizeExport(emptyExportResult(
      normalized,
      generatedAt,
      snapshot.errors,
      request,
      snapshot.warnings,
      snapshot.validation?.workspace ?? null,
      snapshot.validation?.governance ?? null
    ));
  }

  const publicMode = request.exposure === "public";
  const selection = publicMode
    ? selectPublicClosure(snapshot, request.selector)
    : selectSemanticContext(snapshot.index, request.selector);
  const errors = [...selection.errors];
  let documents = [];
  let candidateBoundaries = [];

  const mapped = mapSelectedDocuments(
    errors.length === 0 ? selection.entries : [],
    selection.candidate_entries,
    snapshot.validation
  );
  errors.push(...mapped.errors);
  candidateBoundaries = mapped.candidate_boundaries;
  if (errors.length === 0) {
    documents = mapped.documents;
  }

  const result = {
    schema: CONTEXT_EXPORT_SCHEMA,
    api_version: CORE_API_VERSION,
    status: errors.length === 0 ? "pass" : "fail",
    generated_at: generatedAt,
    request: {
      target: normalized.target ?? null,
      selector: selection.selector,
      exposure: request.exposure ?? null
    },
    source: sourceDescriptor(snapshot.validation.workspace),
    selection: {
      root_ids: selection.semantic_closure.root_ids,
      accepted_ids: errors.length === 0 ? selection.accepted_ids : [],
      selection_paths: selection.semantic_closure.selection_paths
    },
    governance: governanceForEntries(
      snapshot.validation.governance,
      errors.length === 0 ? selection.entries : [],
      selection.publication_closure ?? null
    ),
    documents,
    candidate_boundaries: candidateBoundaries,
    warnings: [...snapshot.warnings, ...selection.warnings],
    errors
  };
  return finalizeExport(result);
}

async function createSnapshot(normalized) {
  const validation = await validatePath(normalized.target, {
    cwd: normalized.cwd,
    now: normalized.now
  });
  if (validation.errors.length > 0) {
    return {
      validation,
      index: null,
      warnings: validation.warnings,
      errors: validation.errors
    };
  }

  const built = await buildSemanticIndexFromValidation(validation, {
    cwd: normalized.cwd,
    now: normalized.now,
    targetPath: normalized.target
  });
  return {
    validation,
    index: built.index,
    warnings: built.warnings,
    errors: built.errors
  };
}

function selectPublicClosure(snapshot, selector) {
  const errors = [];
  const normalized = normalizePublicSelector(selector, errors);
  const governance = snapshot.validation.governance;
  if (!governance) {
    errors.push(inputIssue(
      "exposure",
      "Public context export requires a governed canonical workspace.",
      "Add and validate opendomain/governance.yaml or use a normal semantic selector without public exposure."
    ));
  }

  const product = governance?.products?.find((entry) => entry.id === normalized.product);
  if (governance && (!product || product.exposure !== "public")) {
    errors.push(inputIssue(
      "selector.product",
      `Product '${normalized.product ?? "<missing>"}' is not a validated public product.`,
      "Select one public product declared by the current governance manifest."
    ));
  }

  const closure = governance?.publication_closures?.find((entry) => (
    entry.product_id === normalized.product && entry.status === "pass"
  ));
  if (governance && product?.exposure === "public" && !closure) {
    errors.push(inputIssue(
      "governance.publication_closures",
      `No passing publication closure exists for product '${normalized.product}'.`,
      "Resolve governance validation errors and rebuild the export from the current source snapshot."
    ));
  }

  const sourceFiles = new Set(closure?.source_files ?? []);
  const closureEntries = (snapshot.index.entries ?? [])
    .filter((entry) => sourceFiles.has(entry.source_file));
  if (closure && (closure.source_files ?? []).some((file) => (
    !closureEntries.some((entry) => entry.source_file === file)
  ))) {
    errors.push(inputIssue(
      "governance.publication_closure.source_files",
      "A publication closure source file cannot be mapped to the same validated semantic snapshot.",
      "Revalidate the governed workspace and do not reuse an older closure or index."
    ));
  }

  const entries = closureEntries
    .filter((entry) => entry.status === "accepted")
    .sort(compareById);
  const candidateEntries = closureEntries
    .filter((entry) => entry.type === "domain_candidate")
    .sort(compareById);

  return {
    selector: normalized,
    semantic_closure: {
      policy: {
        id: "opendomain.publication-closure",
        version: governance?.schema_version ?? null
      },
      root_ids: normalized.product ? [normalized.product] : [],
      selection_paths: closure?.selection_paths ?? []
    },
    entries,
    candidate_entries: candidateEntries,
    accepted_ids: entries.map((entry) => entry.id),
    publication_closure: closure ?? null,
    warnings: [],
    errors
  };
}

function normalizePublicSelector(selector, errors) {
  if (!selector || typeof selector !== "object" || Array.isArray(selector)) {
    errors.push(inputIssue(
      "selector",
      "Public context export requires a selector containing one product.",
      "Provide selector: { product: '<public-product-id>' }."
    ));
    return {};
  }
  const keys = Object.keys(selector);
  for (const key of keys) {
    if (key !== "product") {
      errors.push(inputIssue(
        `selector.${key}`,
        `Public context export cannot crop the closure with selector '${key}'.`,
        "Use only the required product selector for public export."
      ));
    }
  }
  if (typeof selector.product !== "string" || selector.product.trim().length === 0) {
    errors.push(inputIssue(
      "selector.product",
      "Public context export requires a non-empty product id.",
      "Select exactly one public product declared by governance.yaml."
    ));
    return {};
  }
  return { product: selector.product.trim() };
}

function mapSelectedDocuments(entries, candidateEntries, validation) {
  const byId = new Map(validation.documents.map((document) => [document.id, document]));
  const errors = [];
  const documents = [];
  const candidates = [];

  for (const entry of entries) {
    const document = byId.get(entry.id);
    if (!document || document.status === "proposed") {
      errors.push(snapshotMappingIssue(entry));
      continue;
    }
    if (validation.workspace?.governed && !hasCompleteOwnership(entry)) {
      errors.push(ownershipMappingIssue(entry));
      continue;
    }
    documents.push(exportedDocument(entry, document));
  }

  for (const entry of candidateEntries) {
    if (validation.workspace?.governed && !hasCompleteOwnership(entry)) {
      errors.push(ownershipMappingIssue(entry));
      continue;
    }
    candidates.push(exportedCandidateBoundary(entry));
  }

  return {
    documents: documents.sort(compareById),
    candidate_boundaries: candidates.sort(compareById),
    errors
  };
}

function exportedDocument(entry, document) {
  const result = {
    id: entry.id,
    type: entry.type,
    name: entry.name,
    status: "accepted",
    authoritative: true,
    frontmatter: document.frontmatter,
    body: document.body,
    summary: entry.summary,
    source: {
      file: entry.source_file,
      hash: entry.source_hash
    },
    review: entry.review,
    evidence: entry.evidence,
    governance: ownership(entry)
  };
  if (entry.context) {
    result.context = entry.context;
  }
  return result;
}

function exportedCandidateBoundary(entry) {
  return {
    id: entry.id,
    type: "domain_candidate",
    status: entry.status,
    authoritative: false,
    target: entry.target ?? {},
    confidence: entry.confidence ?? "unknown",
    possible_conflicts: entry.possible_conflicts ?? [],
    review: entry.review ?? {},
    summary: entry.summary ?? "",
    source: {
      file: entry.source_file,
      hash: entry.source_hash
    },
    governance: ownership(entry)
  };
}

function ownership(entry) {
  if (!entry.product_id) {
    return null;
  }
  return {
    product_id: entry.product_id,
    domain_group_id: entry.domain_group_id,
    owners: [...entry.owners],
    exposure: entry.exposure,
    governance_schema_version: entry.governance_schema_version,
    source_root: entry.governance_source_root
  };
}

function governanceForEntries(governance, entries, publicationClosure) {
  if (!governance) {
    return null;
  }
  const productIds = new Set(entries.map((entry) => entry.product_id).filter(Boolean));
  const groupIds = new Set(entries.map((entry) => entry.domain_group_id).filter(Boolean));
  if (publicationClosure) {
    for (const id of publicationClosure.product_ids ?? []) {
      productIds.add(id);
    }
    for (const id of publicationClosure.domain_group_ids ?? []) {
      groupIds.add(id);
    }
  }
  return {
    schema_version: governance.schema_version,
    manifest: governance.manifest,
    derived: true,
    authoritative_source: governance.authoritative_source,
    products: (governance.products ?? []).filter((entry) => productIds.has(entry.id)),
    domain_groups: (governance.domain_groups ?? []).filter((entry) => groupIds.has(entry.id)),
    publication_closure: publicationClosure
  };
}

function normalizeCommonRequest(request) {
  const errors = [];
  const source = request && typeof request === "object" && !Array.isArray(request)
    ? request
    : {};
  if (source !== request) {
    errors.push(inputIssue(
      "$",
      "Core request must be an object.",
      "Pass an object containing target, cwd, now, and selector as needed."
    ));
  }

  let target;
  if (source.target !== undefined) {
    if (typeof source.target !== "string" || source.target.trim().length === 0) {
      errors.push(inputIssue("target", "Target must be a non-empty string.", "Omit target or provide a file/directory path."));
    } else {
      target = source.target;
    }
  }

  let cwd = process.cwd();
  if (source.cwd !== undefined) {
    if (typeof source.cwd !== "string" || source.cwd.length === 0) {
      errors.push(inputIssue("cwd", "cwd must be a non-empty string.", "Provide an absolute or process-relative working directory."));
    } else {
      cwd = source.cwd;
    }
  }

  let now = source.now instanceof Date ? new Date(source.now.getTime()) : new Date(source.now ?? Date.now());
  if (Number.isNaN(now.getTime())) {
    errors.push(inputIssue("now", "now must be a valid Date or date-time value.", "Provide a valid clock value or omit now."));
    now = new Date(0);
  }
  return { target, cwd, now, errors };
}

function validateExposure(exposure) {
  if (exposure === undefined || exposure === "public") {
    return [];
  }
  return [inputIssue(
    "exposure",
    `Unsupported context export exposure '${String(exposure)}'.`,
    "Omit exposure for normal context export or use exposure: 'public'."
  )];
}

function emptyQueryResult(normalized, generatedAt, errors, warnings = [], workspace = null, governance = null) {
  return {
    schema: CONTEXT_QUERY_SCHEMA,
    api_version: CORE_API_VERSION,
    status: "fail",
    generated_at: generatedAt,
    request: {
      target: normalized.target ?? null,
      selector: {}
    },
    source: sourceDescriptor(workspace),
    governance: governanceForEntries(governance, [], null),
    semantic_closure: {
      policy: null,
      root_ids: [],
      selection_paths: []
    },
    read_first: [],
    accepted_ids: [],
    candidate_boundaries: [],
    verify_with: [],
    warnings,
    errors
  };
}

function emptyExportResult(normalized, generatedAt, errors, request, warnings = [], workspace = null, governance = null) {
  return {
    schema: CONTEXT_EXPORT_SCHEMA,
    api_version: CORE_API_VERSION,
    status: "fail",
    generated_at: generatedAt,
    request: {
      target: normalized.target ?? null,
      selector: {},
      exposure: request?.exposure === "public" ? "public" : null
    },
    source: sourceDescriptor(workspace),
    selection: {
      root_ids: [],
      accepted_ids: [],
      selection_paths: []
    },
    governance: governanceForEntries(governance, [], null),
    documents: [],
    candidate_boundaries: [],
    warnings,
    errors
  };
}

function sourceDescriptor(workspace) {
  return {
    authoritative: true,
    derived: true,
    authority: SOURCE_AUTHORITY,
    workspace
  };
}

function hasCompleteOwnership(entry) {
  return typeof entry.product_id === "string"
    && typeof entry.domain_group_id === "string"
    && Array.isArray(entry.owners)
    && entry.owners.length > 0
    && typeof entry.exposure === "string"
    && typeof entry.governance_schema_version === "string"
    && typeof entry.governance_source_root === "string";
}

function snapshotMappingIssue(entry) {
  return inputIssue(
    "selection",
    `Selected entry '${entry.id}' cannot be mapped to the same validated source snapshot.`,
    "Re-run the query/export against unchanged OpenDomain source files."
  );
}

function ownershipMappingIssue(entry) {
  return inputIssue(
    "governance",
    `Selected governed entry '${entry.id}' is missing complete ownership provenance.`,
    "Revalidate governance ownership and do not infer missing product, group, owner, or exposure metadata."
  );
}

function inputIssue(field, problem, fix) {
  return {
    severity: "error",
    file: "<input>",
    field,
    problem,
    fix
  };
}

function compareById(left, right) {
  return left.id.localeCompare(right.id);
}

function finalizeExport(result) {
  assertContextExportEnvelope(result);
  return portableResult(result);
}

function portableResult(value) {
  return JSON.parse(JSON.stringify(value));
}
