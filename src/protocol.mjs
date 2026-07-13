export const GROUNDING_PROTOCOL_VERSION = "1.0";

export const SEMANTIC_CLOSURE_POLICY = Object.freeze({
  id: "opendomain.semantic-closure",
  version: "1"
});

export const CONTEXT_BUDGET_ESTIMATOR = Object.freeze({
  id: "chars-div-4",
  version: "1"
});

export function emptyContextBudget() {
  return {
    estimator: { ...CONTEXT_BUDGET_ESTIMATOR },
    advisory: true,
    required: {
      source_count: 0,
      estimated_tokens: 0
    },
    optional_candidates: {
      source_count: 0,
      estimated_tokens: 0
    },
    total_possible_estimated_tokens: 0
  };
}
