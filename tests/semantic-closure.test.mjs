import assert from "node:assert/strict";
import test from "node:test";
import {
  SEMANTIC_CLOSURE_REFERENCE_FIELDS,
  collectClosureReferences,
  collectSemanticClosure
} from "../src/semantic-closure.mjs";

test("semantic closure is transitive, cycle-safe, and Candidate-safe", () => {
  const entries = closureEntries();
  const closure = collectSemanticClosure(["sales.order"], entries);

  assert.deepEqual(closure.policy, {
    id: "opendomain.semantic-closure",
    version: "1"
  });
  assert.deepEqual(closure.accepted_ids, [
    "sales",
    "sales.confirmed-order-cannot-be-deleted",
    "sales.order",
    "sales.order-confirmed",
    "sales.order-lifecycle"
  ]);
  assert.ok(!closure.accepted_ids.includes("candidate-0001-order-lifecycle"));
  assert.ok(!closure.accepted_ids.includes("spec.internal-work"));
  assert.equal(new Set(closure.accepted_ids).size, closure.accepted_ids.length);
});

test("semantic closure ordering and selection paths are deterministic", () => {
  const entries = closureEntries();
  const first = collectSemanticClosure(["sales.order"], entries);
  const second = collectSemanticClosure(["sales.order"], [...entries].reverse());

  assert.deepEqual(second.accepted_ids, first.accepted_ids);
  assert.deepEqual(second.selection_paths, first.selection_paths);
  assert.deepEqual(first.selection_paths.find((item) => item.id === "sales"), {
    id: "sales",
    root_id: "sales.order",
    steps: [{
      from: "sales.order",
      field: "context",
      to: "sales"
    }]
  });
});

test("semantic closure exposes and enforces the v1 reference allowlist", () => {
  assert.deepEqual(SEMANTIC_CLOSURE_REFERENCE_FIELDS, [
    "context",
    "rules",
    "lifecycles",
    "events",
    "applies_to",
    "related_rules",
    "related_lifecycle",
    "related[].target"
  ]);

  const references = collectClosureReferences({
    id: "sales.order",
    status: "accepted",
    context: "sales",
    rules: ["sales.rule"],
    unknown_reference: "sales.must-not-traverse",
    relationships: [{ type: "depends_on", target: "identity.customer" }]
  });

  assert.deepEqual(references, [
    { id: "sales", field: "context" },
    { id: "identity.customer", field: "related[].target" },
    { id: "sales.rule", field: "rules" }
  ]);
});

function closureEntries() {
  return [
    {
      id: "sales.order",
      type: "domain_concept",
      status: "accepted",
      context: "sales",
      rules: ["sales.confirmed-order-cannot-be-deleted"],
      lifecycles: ["sales.order-lifecycle"],
      events: ["sales.order-confirmed"],
      relationships: [{
        type: "proposed_extension",
        target: "candidate-0001-order-lifecycle"
      }, {
        type: "delivery_context",
        target: "spec.internal-work"
      }]
    },
    {
      id: "sales",
      type: "bounded_context",
      status: "accepted"
    },
    {
      id: "sales.confirmed-order-cannot-be-deleted",
      type: "business_rule",
      status: "accepted",
      context: "sales",
      applies_to: ["sales.order"]
    },
    {
      id: "sales.order-lifecycle",
      type: "lifecycle",
      status: "accepted",
      context: "sales",
      applies_to: ["sales.order"],
      related_rules: ["sales.confirmed-order-cannot-be-deleted"]
    },
    {
      id: "sales.order-confirmed",
      type: "domain_event",
      status: "accepted",
      context: "sales",
      applies_to: ["sales.order"],
      related_lifecycle: ["sales.order-lifecycle"]
    },
    {
      id: "candidate-0001-order-lifecycle",
      type: "domain_candidate",
      status: "proposed",
      target: { id: "sales.order-lifecycle" }
    },
    {
      id: "spec.internal-work",
      type: "feature_spec",
      status: "accepted",
      affects_domain: {
        concepts: ["sales.order"]
      }
    }
  ];
}
