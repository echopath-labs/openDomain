import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { collectSemanticClosure } from "./semantic-closure.mjs";
import { validatePath } from "./validator.mjs";

export const DEFAULT_INDEX_PATH = ".opendomain/index.json";
export const INDEX_SCHEMA = "opendomain.semantic-index.v1";

export async function buildSemanticIndex(targetPath, options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const now = options.now ?? new Date();
  const validation = await validatePath(targetPath, { cwd, now });

  const result = {
    index: null,
    errors: validation.errors,
    warnings: validation.warnings
  };

  if (validation.errors.length > 0) {
    return result;
  }

  const entries = [];
  for (const document of validation.documents.filter((item) => item.id)) {
    entries.push(await toIndexEntry(document, cwd, now));
  }
  attachReferencingFeatureSpecs(entries);

  result.index = {
    schema: INDEX_SCHEMA,
    generated_at: now.toISOString(),
    source_root: targetPath ?? "<default>",
    derived_from: "OpenDomain Markdown source files in Git",
    authoritative_source: "OpenDomain source files, not this index",
    entries: entries.sort(compareById)
  };

  return result;
}

export async function writeSemanticIndex(index, outPath = DEFAULT_INDEX_PATH, options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const absoluteOut = path.resolve(cwd, outPath);
  await mkdir(path.dirname(absoluteOut), { recursive: true });
  await writeFile(absoluteOut, `${JSON.stringify(index, null, 2)}\n`);
  if (path.isAbsolute(outPath)) {
    return outPath;
  }
  return path.relative(cwd, absoluteOut) || path.basename(absoluteOut);
}

export async function loadSemanticIndex(indexPath = DEFAULT_INDEX_PATH, options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const absoluteIndex = path.resolve(cwd, indexPath);
  const content = await readFile(absoluteIndex, "utf8");
  const index = JSON.parse(content);
  return {
    index,
    file: path.isAbsolute(indexPath)
      ? indexPath
      : path.relative(cwd, absoluteIndex) || path.basename(absoluteIndex)
  };
}

export async function querySemanticIndex(query, options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const indexPath = options.indexPath ?? DEFAULT_INDEX_PATH;
  const loaded = await loadSemanticIndex(indexPath, { cwd });
  const index = loaded.index;
  const entriesById = new Map((index.entries ?? []).map((entry) => [entry.id, entry]));
  const errors = [];
  const warnings = [];
  const queryMode = query.context ? "context" : "id";
  let selectedEntries = [];

  if (query.context) {
    selectedEntries = (index.entries ?? []).filter((entry) => (
      entry.status === "accepted"
      && (entry.context === query.context || entry.id === query.context)
    ));
    if (selectedEntries.length === 0) {
      errors.push(issue({
        field: "context",
        problem: `No accepted index entries found for context '${query.context}'.`,
        fix: "Build the index again or query an existing OpenDomain context id."
      }));
    }
  } else {
    const entry = entriesById.get(query.id);
    if (!entry) {
      errors.push(issue({
        field: "id",
        problem: `Index entry '${query.id}' was not found.`,
        fix: "Build the index again or query an existing OpenDomain id."
      }));
    } else if (entry.status === "accepted") {
      selectedEntries = [entry];
    } else if (entry.type === "domain_candidate") {
      selectedEntries = [];
    } else {
      warnings.push(issue({
        severity: "warning",
        field: "status",
        problem: `Index entry '${query.id}' is not accepted knowledge.`,
        fix: "Treat it as non-authoritative unless accepted in OpenDomain source."
      }));
    }
  }

  const closure = collectSemanticClosure(selectedEntries.map((entry) => entry.id), index.entries ?? []);
  const readFirst = closure.entries;
  const readFirstIds = new Set(readFirst.map((entry) => entry.id));
  const candidateBoundaries = collectCandidateBoundaries(index.entries ?? [], readFirstIds, query);
  const staleWarnings = await checkFreshness([...readFirst, ...candidateBoundaries], cwd);
  warnings.push(...staleWarnings);

  return {
    query: queryMode === "context"
      ? { context: query.context }
      : { id: query.id },
    index_file: loaded.file,
    schema: index.schema,
    source_files_authoritative: true,
    authoritative_source: index.authoritative_source ?? "OpenDomain source files, not this index",
    semantic_closure: {
      policy: closure.policy,
      root_ids: closure.root_ids,
      selection_paths: closure.selection_paths
    },
    read_first: readFirst.map(toReadFirstItem),
    accepted_ids: readFirst.map((entry) => entry.id).sort(),
    candidate_boundaries: candidateBoundaries.map(toCandidateBoundary),
    verify_with: readFirst.map(toVerificationItem),
    warnings,
    errors
  };
}

async function toIndexEntry(document, cwd, now) {
  const frontmatter = document.frontmatter;
  const sourceFile = document.file;
  return {
    id: document.id,
    type: document.type,
    name: frontmatter.name ?? document.id,
    context: frontmatter.context ?? (document.type === "bounded_context" ? document.id : undefined),
    status: frontmatter.status,
    source_file: sourceFile,
    summary: summarizeDocument(document),
    aliases: arrayOrEmpty(frontmatter.aliases),
    relationships: arrayOrEmpty(frontmatter.related).map((relationship) => ({
      type: relationship?.type,
      target: relationship?.target
    })).filter((relationship) => relationship.type || relationship.target),
    rules: arrayOrEmpty(frontmatter.rules),
    lifecycles: arrayOrEmpty(frontmatter.lifecycles),
    events: arrayOrEmpty(frontmatter.events),
    applies_to: arrayOrEmpty(frontmatter.applies_to),
    related_rules: arrayOrEmpty(frontmatter.related_rules),
    related_lifecycle: arrayOrEmpty(frontmatter.related_lifecycle),
    target: frontmatter.target,
    affects_domain: frontmatter.affects_domain,
    proposed_change_type: frontmatter.proposed_change_type,
    confidence: frontmatter.confidence,
    possible_conflicts: arrayOrEmpty(frontmatter.possible_conflicts),
    referencing_feature_specs: [],
    evidence: arrayOrEmpty(frontmatter.evidence),
    review: frontmatter.review,
    source_hash: await hashFile(path.resolve(cwd, sourceFile)),
    last_indexed_at: now.toISOString()
  };
}

function attachReferencingFeatureSpecs(entries) {
  const referencesById = new Map();
  for (const entry of entries.filter((item) => item.type === "feature_spec")) {
    for (const id of collectAffectsDomainIds(entry.affects_domain)) {
      const references = referencesById.get(id) ?? [];
      references.push(entry.id);
      referencesById.set(id, references);
    }
  }

  for (const entry of entries) {
    entry.referencing_feature_specs = (referencesById.get(entry.id) ?? []).sort();
  }
}

function collectAffectsDomainIds(affectsDomain) {
  if (!affectsDomain || typeof affectsDomain !== "object") {
    return [];
  }
  return [
    ...arrayOrEmpty(affectsDomain.concepts),
    ...arrayOrEmpty(affectsDomain.rules),
    ...arrayOrEmpty(affectsDomain.lifecycles),
    ...arrayOrEmpty(affectsDomain.events)
  ];
}

function collectCandidateBoundaries(entries, readFirstIds, query) {
  return entries
    .filter((entry) => entry.type === "domain_candidate")
    .filter((entry) => {
      const targetId = entry.target?.id;
      return readFirstIds.has(targetId)
        || (query.id && entry.id === query.id)
        || (query.context && entry.context === query.context);
    })
    .sort(compareById);
}

async function checkFreshness(entries, cwd) {
  const warnings = [];
  for (const entry of entries) {
    try {
      const currentHash = await hashFile(path.resolve(cwd, entry.source_file));
      if (currentHash !== entry.source_hash) {
        warnings.push(issue({
          severity: "warning",
          field: "source_hash",
          problem: `Index entry '${entry.id}' is stale because ${entry.source_file} changed after index build.`,
          fix: "Run opendomain index build again."
        }));
      }
    } catch {
      warnings.push(issue({
        severity: "warning",
        field: "source_file",
        problem: `Index entry '${entry.id}' points to missing source file ${entry.source_file}.`,
        fix: "Restore the source file or rebuild the index."
      }));
    }
  }
  return warnings;
}

async function hashFile(file) {
  const content = await readFile(file);
  return createHash("sha256").update(content).digest("hex");
}

function summarizeDocument(document) {
  if (document.frontmatter.summary) {
    return String(document.frontmatter.summary);
  }

  const paragraph = document.body
    .split(/\r?\n\r?\n/)
    .map((block) => block.trim())
    .find((block) => block && !block.startsWith("#") && !block.startsWith("```"));

  if (!paragraph) {
    return document.frontmatter.name ?? document.id;
  }

  return paragraph.replace(/\s+/g, " ").slice(0, 240);
}

function toReadFirstItem(entry) {
  return {
    id: entry.id,
    type: entry.type,
    name: entry.name,
    status: entry.status,
    context: entry.context,
    source_file: entry.source_file,
    summary: entry.summary,
    referencing_feature_specs: entry.referencing_feature_specs,
    source_hash: entry.source_hash
  };
}

function toCandidateBoundary(entry) {
  return {
    id: entry.id,
    status: entry.status,
    target_id: entry.target?.id,
    confidence: entry.confidence,
    source_file: entry.source_file,
    summary: entry.summary
  };
}

function toVerificationItem(entry) {
  return {
    id: entry.id,
    source_file: entry.source_file,
    evidence: entry.evidence,
    review: entry.review
  };
}

function arrayOrEmpty(value) {
  return Array.isArray(value) ? value : [];
}

function compareById(left, right) {
  return left.id.localeCompare(right.id);
}

function issue(issueFields) {
  return {
    severity: issueFields.severity ?? "error",
    file: issueFields.file ?? "<index>",
    field: issueFields.field,
    problem: issueFields.problem,
    fix: issueFields.fix
  };
}
