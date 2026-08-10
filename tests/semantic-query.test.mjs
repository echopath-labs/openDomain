import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { buildSemanticIndex } from "../src/indexer.mjs";
import { selectSemanticContext } from "../src/semantic-query.mjs";

const REPOSITORY_ROOT = path.resolve(".");
const ERP_TARGET = "examples/erp";
const GOVERNED_ROOT = path.resolve("tests/fixtures/valid/governed-multi-product");
const NOW = new Date("2026-08-10T00:00:00Z");

test("shared selector supports semantic id, context, lifecycle, type, and deterministic AND", async () => {
  const built = await buildSemanticIndex(ERP_TARGET, { cwd: REPOSITORY_ROOT, now: NOW });
  assert.deepEqual(built.errors, []);

  const byId = selectSemanticContext(built.index, { id: "sales.order" });
  assert.deepEqual(byId.errors, []);
  assert.deepEqual(byId.semantic_closure.root_ids, ["sales.order"]);
  assert.ok(byId.accepted_ids.includes("sales.order-lifecycle"));
  assert.deepEqual(byId.candidate_boundaries.map((item) => item.id), [
    "candidate-0001-order-lifecycle"
  ]);

  const byContextAndType = selectSemanticContext(built.index, {
    context: "sales",
    type: "domain_concept"
  });
  assert.deepEqual(byContextAndType.errors, []);
  assert.deepEqual(byContextAndType.semantic_closure.root_ids, ["sales.order"]);

  const byLifecycle = selectSemanticContext(built.index, {
    lifecycle: "sales.order-lifecycle",
    type: "domain_concept"
  });
  assert.deepEqual(byLifecycle.errors, []);
  assert.deepEqual(byLifecycle.semantic_closure.root_ids, ["sales.order"]);
});

test("shared selector supports governed product, group, and owner fields", async () => {
  const built = await buildSemanticIndex(undefined, { cwd: GOVERNED_ROOT, now: NOW });
  assert.deepEqual(built.errors, []);

  const byProduct = selectSemanticContext(built.index, { product: "alpha" });
  assert.deepEqual(byProduct.errors, []);
  assert.deepEqual(byProduct.semantic_closure.root_ids, [
    "alpha",
    "alpha_ecosystem",
    "alpha_internal",
    "alpha_private"
  ]);

  const byGroupAndOwner = selectSemanticContext(built.index, {
    domain_group: "alpha.public",
    owner: "alpha-owner"
  });
  assert.deepEqual(byGroupAndOwner.errors, []);
  assert.deepEqual(byGroupAndOwner.semantic_closure.root_ids, ["alpha"]);
});

test("shared selector fails closed for missing, unknown, ungoverned, and Candidate-only inputs", async () => {
  const built = await buildSemanticIndex(ERP_TARGET, { cwd: REPOSITORY_ROOT, now: NOW });

  assert.equal(selectSemanticContext(built.index, {}).errors.length, 1);
  assert.equal(selectSemanticContext(built.index, { unsupported: "x" }).errors.length, 1);
  assert.match(
    selectSemanticContext(built.index, { product: "alpha" }).errors[0].problem,
    /requires validated governance metadata/
  );

  const candidate = selectSemanticContext(built.index, {
    id: "candidate-0001-order-lifecycle"
  });
  assert.equal(candidate.entries.length, 0);
  assert.equal(candidate.errors.length, 1);
  assert.deepEqual(candidate.candidate_boundaries.map((item) => item.id), [
    "candidate-0001-order-lifecycle"
  ]);
});
