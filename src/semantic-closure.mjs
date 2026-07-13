import { SEMANTIC_CLOSURE_POLICY } from "./protocol.mjs";

export const SEMANTIC_CLOSURE_REFERENCE_FIELDS = Object.freeze([
  "context",
  "rules",
  "lifecycles",
  "events",
  "applies_to",
  "related_rules",
  "related_lifecycle",
  "related[].target"
]);

const DIRECT_REFERENCE_FIELDS = SEMANTIC_CLOSURE_REFERENCE_FIELDS.filter((field) => field !== "related[].target");
const ACCEPTED_CLOSURE_TYPES = new Set([
  "bounded_context",
  "domain_concept",
  "business_rule",
  "lifecycle",
  "domain_event"
]);

export function collectSemanticClosure(rootIds, entries) {
  const entriesById = new Map();
  for (const entry of entries) {
    const id = entryId(entry);
    if (id) {
      entriesById.set(id, entry);
    }
  }

  const roots = [...new Set(rootIds.filter(Boolean))].sort();
  const queue = roots.map((id) => ({ id, rootId: id, steps: [] }));
  const queuedIds = new Set(roots);
  const selectedEntries = [];
  const selectionById = new Map();

  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    const entry = entriesById.get(current.id);
    if (!entry || entryStatus(entry) !== "accepted" || !ACCEPTED_CLOSURE_TYPES.has(entryType(entry))) {
      continue;
    }

    selectedEntries.push(entry);
    selectionById.set(current.id, {
      id: current.id,
      root_id: current.rootId,
      steps: current.steps
    });

    for (const reference of collectClosureReferences(entry)) {
      if (queuedIds.has(reference.id)) {
        continue;
      }
      queuedIds.add(reference.id);
      queue.push({
        id: reference.id,
        rootId: current.rootId,
        steps: [
          ...current.steps,
          {
            from: current.id,
            field: reference.field,
            to: reference.id
          }
        ]
      });
    }
  }

  selectedEntries.sort(compareEntriesById);
  const acceptedIds = selectedEntries.map(entryId);

  return {
    policy: { ...SEMANTIC_CLOSURE_POLICY },
    root_ids: roots,
    entries: selectedEntries,
    accepted_ids: acceptedIds,
    selection_paths: acceptedIds.map((id) => selectionById.get(id))
  };
}

export function collectClosureReferences(entry) {
  const frontmatter = entry.frontmatter ?? entry;
  const references = [];

  for (const field of DIRECT_REFERENCE_FIELDS) {
    const value = frontmatter[field];
    if (Array.isArray(value)) {
      for (const id of value) {
        if (typeof id === "string" && id) {
          references.push({ id, field });
        }
      }
    } else if (typeof value === "string" && value) {
      references.push({ id: value, field });
    }
  }

  for (const relationship of arrayOrEmpty(frontmatter.related ?? frontmatter.relationships)) {
    if (typeof relationship?.target === "string" && relationship.target) {
      references.push({
        id: relationship.target,
        field: "related[].target"
      });
    }
  }

  return uniqueReferences(references).sort((left, right) => (
    left.field.localeCompare(right.field) || left.id.localeCompare(right.id)
  ));
}

function entryId(entry) {
  return entry.id ?? entry.frontmatter?.id;
}

function entryStatus(entry) {
  return entry.status ?? entry.frontmatter?.status;
}

function entryType(entry) {
  return entry.type ?? entry.frontmatter?.type;
}

function compareEntriesById(left, right) {
  return entryId(left).localeCompare(entryId(right));
}

function uniqueReferences(references) {
  const seen = new Set();
  return references.filter((reference) => {
    const key = `${reference.field}\u0000${reference.id}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function arrayOrEmpty(value) {
  return Array.isArray(value) ? value : [];
}
