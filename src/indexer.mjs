import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { selectSemanticContext } from "./semantic-query.mjs";
import { validatePath } from "./validator.mjs";
import {
  LEGACY_DEFAULT_INDEX_PATH,
  resolveDefaultIndexPath
} from "./workspace-resolver.mjs";

export const DEFAULT_INDEX_PATH = LEGACY_DEFAULT_INDEX_PATH;
export const INDEX_SCHEMA = "opendomain.semantic-index.v1";

export async function buildSemanticIndex(targetPath, options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const now = options.now ?? new Date();
  const validation = await validatePath(targetPath, { cwd, now });

  return buildSemanticIndexFromValidation(validation, {
    cwd,
    now,
    targetPath
  });
}

export async function buildSemanticIndexFromValidation(validation, options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const now = options.now ?? new Date();
  const targetPath = options.targetPath;

  const result = {
    index: null,
    errors: validation.errors,
    warnings: validation.warnings,
    defaultIndexPath: validation.workspace?.default_index_path ?? DEFAULT_INDEX_PATH
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
    source_root: validation.workspace?.source_root ?? targetPath ?? "<default>",
    derived_from: "OpenDomain Markdown source files in Git",
    authoritative_source: "OpenDomain source files, not this index",
    ...(validation.governance
      ? {
          governance: {
            schema_version: validation.governance.schema_version,
            manifest: validation.governance.manifest,
            derived: true,
            authoritative_source: validation.governance.authoritative_source,
            publication_closures: validation.governance.publication_closures
          }
        }
      : {}),
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
  let indexPath = options.indexPath;
  const resolutionWarnings = [];
  if (!indexPath) {
    const resolution = await resolveDefaultIndexPath({ cwd });
    resolutionWarnings.push(...resolution.warnings);
    if (resolution.errors.length > 0) {
      return emptyQueryResult(query, {
        indexPath: null,
        warnings: resolutionWarnings,
        errors: resolution.errors
      });
    }
    indexPath = resolution.defaultIndexPath;
  }
  const loaded = await loadSemanticIndex(indexPath, { cwd });
  const index = loaded.index;
  const selection = selectSemanticContext(index, query);
  const warnings = [...resolutionWarnings, ...selection.warnings];
  const staleWarnings = await checkFreshness(
    [...selection.entries, ...selection.candidate_entries],
    cwd
  );
  warnings.push(...staleWarnings);

  return {
    query: query.context
      ? { context: query.context }
      : { id: query.id },
    index_file: loaded.file,
    schema: index.schema,
    source_files_authoritative: true,
    authoritative_source: index.authoritative_source ?? "OpenDomain source files, not this index",
    semantic_closure: selection.semantic_closure,
    read_first: selection.read_first,
    accepted_ids: selection.accepted_ids,
    candidate_boundaries: selection.candidate_boundaries,
    verify_with: selection.verify_with,
    warnings,
    errors: selection.errors
  };
}

function emptyQueryResult(query, { indexPath, warnings, errors }) {
  return {
    query: query.context ? { context: query.context } : { id: query.id },
    index_file: indexPath,
    schema: null,
    source_files_authoritative: true,
    authoritative_source: "OpenDomain source files, not this index",
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
    last_indexed_at: now.toISOString(),
    ...(document.ownership
      ? {
          product_id: document.ownership.product_id,
          domain_group_id: document.ownership.domain_group_id,
          owners: [...document.ownership.owners],
          exposure: document.ownership.exposure,
          governance_schema_version: document.ownership.governance_schema_version,
          governance_source_root: document.ownership.source_root
        }
      : {})
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
