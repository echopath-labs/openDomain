import { buildGroundingRequest, collectAffectedIds } from "./grounding-request.mjs";
import { validatePath } from "./validator.mjs";
import { estimateContextBudget } from "./context-budget.mjs";
import { GROUNDING_PROTOCOL_VERSION, SEMANTIC_CLOSURE_POLICY, emptyContextBudget } from "./protocol.mjs";
import { collectSemanticClosure } from "./semantic-closure.mjs";

export async function prepareGroundingPack(inputPath, options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const requestResult = await buildGroundingRequest(inputPath, {
    cwd,
    integration: options.integration ?? "auto"
  });

  if (requestResult.errors.length > 0) {
    return emptyPack({
      input: inputPath,
      errors: requestResult.errors
    });
  }

  const corpus = await validatePath(undefined, { cwd, now: options.now ?? new Date() });
  const documentsById = new Map(corpus.documents.filter((document) => document.id).map((document) => [document.id, document]));
  const groundingRequest = requestResult.request;
  const affectedIds = collectAffectedIds(groundingRequest.affects_domain);
  const acceptedRootIds = [];
  const errors = [...corpus.errors];
  const warnings = [...corpus.warnings];

  for (const affected of affectedIds) {
    const document = documentsById.get(affected.id);
    if (!document) {
      errors.push(issue({
        file: groundingRequest.source.path,
        field: affected.field,
        problem: `Broken affects_domain reference '${affected.id}'.`,
        fix: "Create the referenced OpenDomain object or correct the id."
      }));
      continue;
    }

    if (document.frontmatter.status !== "accepted") {
      errors.push(issue({
        file: groundingRequest.source.path,
        field: affected.field,
        problem: `Feature spec references non-accepted OpenDomain knowledge '${affected.id}'.`,
        fix: "Reference accepted OpenDomain knowledge, or keep uncertain knowledge in Candidate form."
      }));
      continue;
    }

    acceptedRootIds.push(document.id);
  }

  const closure = collectSemanticClosure(acceptedRootIds, corpus.documents);
  const readFirst = closure.entries.map(toReadItem);
  const readFirstIds = new Set(readFirst.map((item) => item.id));
  const candidateBoundaries = corpus.documents
    .filter((document) => document.type === "domain_candidate")
    .filter((document) => readFirstIds.has(document.frontmatter.target?.id))
    .map(toCandidateItem)
    .sort(compareById);

  const contextBudget = await estimateContextBudget(readFirst, candidateBoundaries, { cwd });

  const avoidedSemanticErrors = readFirst
    .filter((item) => item.type === "business_rule")
    .map((item) => ({
      id: item.id,
      source_file: item.file,
      summary: avoidedErrorSummary(item)
    }));

  return {
    protocol_version: GROUNDING_PROTOCOL_VERSION,
    feature: {
      id: groundingRequest.intent.id,
      name: groundingRequest.intent.name,
      file: groundingRequest.source.path
    },
    grounding_request: groundingRequest,
    read_first: uniqueById(readFirst).sort(compareById),
    candidate_boundaries: candidateBoundaries,
    context_budget: contextBudget,
    semantic_closure: {
      policy: closure.policy,
      root_ids: closure.root_ids,
      selection_paths: closure.selection_paths
    },
    avoided_semantic_errors: avoidedSemanticErrors,
    errors,
    warnings
  };
}

export function formatGroundingPack(pack) {
  if (pack.errors.length > 0) {
    return formatPackIssues(pack);
  }

  const lines = [
    "Domain Grounding Pack",
    "",
    `Protocol: ${pack.protocol_version}`,
    `Feature: ${pack.feature.id}`,
    `File: ${pack.feature.file}`,
    "",
    "Read first:"
  ];

  for (const item of pack.read_first) {
    lines.push(`- ${item.id} (${item.type}) -> ${item.file}`);
  }

  lines.push("", "Candidate boundaries:");
  if (pack.candidate_boundaries.length === 0) {
    lines.push("- None");
  } else {
    for (const item of pack.candidate_boundaries) {
      lines.push(`- ${item.id} -> ${item.file}`);
      lines.push(`  target: ${item.target_id}`);
      lines.push(`  status: ${item.status}`);
    }
  }

  lines.push("", "Context budget (advisory):");
  lines.push(`- Required: ${pack.context_budget.required.source_count} sources, ~${pack.context_budget.required.estimated_tokens} tokens`);
  lines.push(`- Optional Candidates: ${pack.context_budget.optional_candidates.source_count} sources, ~${pack.context_budget.optional_candidates.estimated_tokens} tokens`);
  lines.push(`- Total possible: ~${pack.context_budget.total_possible_estimated_tokens} tokens`);

  lines.push("", "Avoided semantic errors:");
  if (pack.avoided_semantic_errors.length === 0) {
    lines.push("- None declared by affected accepted rules");
  } else {
    for (const item of pack.avoided_semantic_errors) {
      lines.push(`- ${item.summary}`);
    }
  }

  if (pack.warnings.length > 0) {
    lines.push("", "Warnings:");
    for (const warning of pack.warnings) {
      lines.push(`- ${warning.file} ${warning.field}: ${warning.problem}`);
    }
  }

  lines.push("", "Final response reminder:");
  lines.push("- Include 'Domain Grounding Used' with the accepted IDs read.");
  lines.push("- Report Candidate files as proposed knowledge, not accepted truth.");

  return `${lines.join("\n")}\n`;
}

function formatPackIssues(pack) {
  const lines = ["Domain Grounding Pack failed.", ""];
  for (const error of pack.errors) {
    lines.push(`[${error.severity}] ${error.file}`);
    lines.push(`  field: ${error.field}`);
    lines.push(`  problem: ${error.problem}`);
    lines.push(`  fix: ${error.fix}`);
  }
  return `${lines.join("\n")}\n`;
}

function toReadItem(document) {
  return {
    id: document.id,
    type: document.type,
    name: document.frontmatter.name,
    status: document.frontmatter.status,
    file: document.file,
    context: document.frontmatter.context
  };
}

function toCandidateItem(document) {
  return {
    id: document.id,
    status: document.frontmatter.status,
    target_id: document.frontmatter.target?.id,
    confidence: document.frontmatter.confidence,
    file: document.file
  };
}

function avoidedErrorSummary(item) {
  if (item.id === "sales.confirmed-order-cannot-be-deleted") {
    return "Do not add direct deletion behavior for confirmed orders; use cancellation semantics instead.";
  }
  return `Respect accepted business rule '${item.name ?? item.id}' while implementing this feature.`;
}

function uniqueById(items) {
  const seen = new Set();
  const unique = [];
  for (const item of items) {
    if (seen.has(item.id)) {
      continue;
    }
    seen.add(item.id);
    unique.push(item);
  }
  return unique;
}

function compareById(left, right) {
  return left.id.localeCompare(right.id);
}

function emptyPack({ input, errors }) {
  return {
    protocol_version: GROUNDING_PROTOCOL_VERSION,
    feature: {
      id: null,
      name: null,
      file: input ?? null
    },
    grounding_request: null,
    read_first: [],
    candidate_boundaries: [],
    context_budget: emptyContextBudget(),
    semantic_closure: {
      policy: { ...SEMANTIC_CLOSURE_POLICY },
      root_ids: [],
      selection_paths: []
    },
    avoided_semantic_errors: [],
    errors,
    warnings: []
  };
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
