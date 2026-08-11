import { collectSemanticClosure } from "./semantic-closure.mjs";

export const SEMANTIC_SELECTOR_FIELDS = Object.freeze([
  "id",
  "context",
  "product",
  "domain_group",
  "owner",
  "lifecycle",
  "type"
]);

const SELECTOR_FIELD_SET = new Set(SEMANTIC_SELECTOR_FIELDS);
const GOVERNANCE_SELECTOR_FIELDS = new Set(["product", "domain_group", "owner"]);

export function selectSemanticContext(index, selector) {
  const entries = Array.isArray(index?.entries) ? index.entries : [];
  const errors = [];
  const warnings = [];
  const normalized = normalizeSelector(selector, errors);

  for (const field of GOVERNANCE_SELECTOR_FIELDS) {
    if (normalized[field] && !entries.some((entry) => hasGovernanceField(entry, field))) {
      errors.push(issue({
        field: `selector.${field}`,
        problem: `Selector '${field}' requires validated governance metadata.`,
        fix: "Use a governed canonical workspace or remove the governance selector."
      }));
    }
  }

  let seeds = [];
  if (errors.length === 0) {
    seeds = entries
      .filter((entry) => entry.status === "accepted")
      .filter((entry) => matchesSelector(entry, normalized))
      .sort(compareById);
  }

  const directlySelectedCandidate = normalized.id
    ? entries.find((entry) => entry.id === normalized.id && entry.type === "domain_candidate")
    : null;

  if (errors.length === 0 && seeds.length === 0) {
    errors.push(issue({
      field: directlySelectedCandidate ? "selector.id" : "selector",
      problem: directlySelectedCandidate
        ? `Selector id '${normalized.id}' identifies a non-authoritative Domain Candidate, not accepted knowledge.`
        : "No accepted OpenDomain entries match the supplied selector.",
      fix: directlySelectedCandidate
        ? "Review the Candidate boundary or select an accepted target id."
        : "Use a selector that matches accepted knowledge in the validated workspace."
    }));
  }

  const closure = collectSemanticClosure(seeds.map((entry) => entry.id), entries);
  const selected = closure.entries
    .filter((entry) => entry.status === "accepted")
    .sort(compareById);
  const selectedIds = new Set(selected.map((entry) => entry.id));
  const candidateEntries = entries
    .filter((entry) => entry.type === "domain_candidate")
    .filter((entry) => (
      selectedIds.has(entry.target?.id)
      || (directlySelectedCandidate && entry.id === directlySelectedCandidate.id)
      || (normalized.context && entry.context === normalized.context)
      || matchesGovernanceSelector(entry, normalized)
    ))
    .sort(compareById);

  return {
    selector: normalized,
    semantic_closure: {
      policy: closure.policy,
      root_ids: closure.root_ids,
      selection_paths: closure.selection_paths
    },
    entries: selected,
    candidate_entries: candidateEntries,
    read_first: selected.map(toReadFirstItem),
    accepted_ids: selected.map((entry) => entry.id),
    candidate_boundaries: candidateEntries.map(toCandidateBoundary),
    verify_with: selected.map(toVerificationItem),
    warnings,
    errors
  };
}

function normalizeSelector(selector, errors) {
  if (!selector || typeof selector !== "object" || Array.isArray(selector)) {
    errors.push(issue({
      field: "selector",
      problem: "A semantic selector object is required.",
      fix: `Provide at least one of: ${SEMANTIC_SELECTOR_FIELDS.join(", ")}.`
    }));
    return {};
  }

  const normalized = {};
  for (const [field, value] of Object.entries(selector)) {
    if (!SELECTOR_FIELD_SET.has(field)) {
      errors.push(issue({
        field: `selector.${field}`,
        problem: `Unknown semantic selector '${field}'.`,
        fix: `Use only: ${SEMANTIC_SELECTOR_FIELDS.join(", ")}.`
      }));
      continue;
    }
    if (typeof value !== "string" || value.trim().length === 0) {
      errors.push(issue({
        field: `selector.${field}`,
        problem: `Selector '${field}' must be a non-empty string.`,
        fix: `Provide a non-empty ${field} selector value.`
      }));
      continue;
    }
    normalized[field] = value.trim();
  }

  if (Object.keys(normalized).length === 0 && errors.length === 0) {
    errors.push(issue({
      field: "selector",
      problem: "At least one semantic selector is required.",
      fix: `Provide one of: ${SEMANTIC_SELECTOR_FIELDS.join(", ")}.`
    }));
  }
  return normalized;
}

function matchesSelector(entry, selector) {
  return (!selector.id || entry.id === selector.id)
    && (!selector.context || entry.context === selector.context || entry.id === selector.context)
    && (!selector.product || entry.product_id === selector.product)
    && (!selector.domain_group || entry.domain_group_id === selector.domain_group)
    && (!selector.owner || arrayOrEmpty(entry.owners).includes(selector.owner))
    && (!selector.lifecycle || matchesLifecycle(entry, selector.lifecycle))
    && (!selector.type || entry.type === selector.type);
}

function matchesGovernanceSelector(entry, selector) {
  const governanceFields = ["product", "domain_group", "owner"]
    .filter((field) => selector[field]);
  return governanceFields.length > 0 && governanceFields.every((field) => {
    if (field === "product") {
      return entry.product_id === selector.product;
    }
    if (field === "domain_group") {
      return entry.domain_group_id === selector.domain_group;
    }
    return arrayOrEmpty(entry.owners).includes(selector.owner);
  });
}

function matchesLifecycle(entry, lifecycle) {
  return (entry.type === "lifecycle" && entry.id === lifecycle)
    || arrayOrEmpty(entry.lifecycles).includes(lifecycle)
    || arrayOrEmpty(entry.related_lifecycle).includes(lifecycle);
}

function hasGovernanceField(entry, field) {
  if (field === "product") {
    return typeof entry.product_id === "string";
  }
  if (field === "domain_group") {
    return typeof entry.domain_group_id === "string";
  }
  return Array.isArray(entry.owners);
}

export function toReadFirstItem(entry) {
  return compact({
    id: entry.id,
    type: entry.type,
    name: entry.name,
    status: entry.status,
    context: entry.context,
    source_file: entry.source_file,
    summary: entry.summary,
    referencing_feature_specs: entry.referencing_feature_specs,
    source_hash: entry.source_hash
  });
}

export function toCandidateBoundary(entry) {
  return compact({
    id: entry.id,
    status: entry.status,
    target_id: entry.target?.id,
    confidence: entry.confidence,
    source_file: entry.source_file,
    summary: entry.summary
  });
}

export function toVerificationItem(entry) {
  return compact({
    id: entry.id,
    source_file: entry.source_file,
    evidence: entry.evidence,
    review: entry.review
  });
}

function compact(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}

function arrayOrEmpty(value) {
  return Array.isArray(value) ? value : [];
}

function compareById(left, right) {
  return left.id.localeCompare(right.id);
}

function issue({ field, problem, fix }) {
  return {
    severity: "error",
    file: "<input>",
    field,
    problem,
    fix
  };
}
