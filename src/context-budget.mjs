import { readFile } from "node:fs/promises";
import path from "node:path";
import { CONTEXT_BUDGET_ESTIMATOR } from "./protocol.mjs";

export async function estimateContextBudget(requiredSources, optionalCandidateSources, options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const required = await estimateSourceGroup(requiredSources, cwd);
  const optionalCandidates = await estimateSourceGroup(optionalCandidateSources, cwd);

  return {
    estimator: { ...CONTEXT_BUDGET_ESTIMATOR },
    advisory: true,
    required,
    optional_candidates: optionalCandidates,
    total_possible_estimated_tokens: required.estimated_tokens + optionalCandidates.estimated_tokens
  };
}

export function estimateTextTokens(content) {
  return Math.ceil(content.length / 4);
}

async function estimateSourceGroup(sources, cwd) {
  const files = [...new Set(sources.map(sourceFile).filter(Boolean))].sort();
  let estimatedTokens = 0;

  for (const file of files) {
    const content = await readFile(path.resolve(cwd, file), "utf8");
    estimatedTokens += estimateTextTokens(content);
  }

  return {
    source_count: files.length,
    estimated_tokens: estimatedTokens
  };
}

function sourceFile(source) {
  if (typeof source === "string") {
    return source;
  }
  return source?.file ?? source?.source_file;
}
