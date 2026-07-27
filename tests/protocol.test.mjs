import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { estimateTextTokens } from "../src/context-budget.mjs";
import { buildGroundingRequest } from "../src/grounding-request.mjs";
import {
  buildSemanticIndex,
  querySemanticIndex,
  writeSemanticIndex
} from "../src/indexer.mjs";
import { prepareGroundingPack } from "../src/prepare.mjs";

const ERP_ROOT = path.resolve("examples/erp");
const FEATURE_PATH = "openspec/changes/order-cancellation/spec.md";

test("successful Grounding Pack exposes stable v1 fields and alpha metadata", async () => {
  const pack = await prepareGroundingPack(FEATURE_PATH, { cwd: ERP_ROOT });
  const packSchema = await readJson("schemas/grounding-pack.schema.json");
  const requestSchema = await readJson("schemas/grounding-request.schema.json");

  assertRequiredFields(pack, packSchema.required);
  assertRequiredFields(pack.grounding_request, requestSchema.required);
  assert.equal(pack.protocol_version, "1.0");
  assert.equal(pack.grounding_request.protocol_version, "1.0");
  assert.equal(pack.grounding_request.integration.id, "openspec");
  assert.equal(pack.feature.id, "spec.order-cancellation");
  assert.ok(Array.isArray(pack.avoided_semantic_errors));
  assert.equal(pack.errors.length, 0);
});

test("failed Grounding Pack retains stable v1 fields", async () => {
  const pack = await prepareGroundingPack("does-not-exist.md");

  assert.equal(pack.protocol_version, "1.0");
  assert.equal(pack.grounding_request, null);
  assert.deepEqual(pack.read_first, []);
  assert.deepEqual(pack.candidate_boundaries, []);
  assert.deepEqual(pack.context_budget, {
    estimator: { id: "chars-div-4", version: "1" },
    advisory: true,
    required: { source_count: 0, estimated_tokens: 0 },
    optional_candidates: { source_count: 0, estimated_tokens: 0 },
    total_possible_estimated_tokens: 0
  });
  assert.ok(pack.errors.some((error) => error.problem.includes("does not exist")));
  assert.ok(Array.isArray(pack.warnings));
});

test("schema-invalid accepted knowledge cannot enter Grounding Pack read_first", async () => {
  const cwd = path.resolve("tests/fixtures/invalid/schema-invalid-rule");
  const pack = await prepareGroundingPack("feature.md", { cwd });

  assert.ok(pack.errors.some((issue) => (
    issue.file.endsWith("invalid-rule.md")
    && issue.field === "id"
    && issue.problem.includes("rule.schema.json")
  )));
  assert.equal(pack.read_first.some((item) => item.id === "BAD"), false);
  assert.deepEqual(pack.read_first, []);
});

test("OpenSpec adapter rejects an invalid request before grounding", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "opendomain-invalid-request-"));
  await writeFile(path.join(cwd, "spec.md"), `---
type: feature_spec
id: spec.invalid
status: proposed
affects_domain:
  concepts:
    - sales.order
---
`, "utf8");

  const result = await buildGroundingRequest("spec.md", { cwd });

  assert.equal(result.request, null);
  assert.ok(result.errors.some((error) => error.field === "name"));
});

test("OpenSpec adapter normalizes duplicate affected IDs", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "opendomain-request-normalization-"));
  await writeFile(path.join(cwd, "spec.md"), `---
type: feature_spec
id: spec.normalized
name: Normalized request
status: proposed
affects_domain:
  concepts:
    - sales.order
    - sales.order
---
`, "utf8");

  const result = await buildGroundingRequest("spec.md", { cwd });

  assert.equal(result.errors.length, 0);
  assert.deepEqual(result.request.affects_domain.concepts, ["sales.order"]);
});

test("automatic selection preserves OpenSpec input outside a project with local Profiles", async (context) => {
  const project = await mkdtemp(path.join(os.tmpdir(), "opendomain-project-with-profile-"));
  const external = await mkdtemp(path.join(os.tmpdir(), "opendomain-external-openspec-"));
  context.after(() => Promise.all([
    rm(project, { recursive: true, force: true }),
    rm(external, { recursive: true, force: true })
  ]));

  await mkdir(path.join(project, "opendomain/integrations/profiles"), { recursive: true });
  await writeFile(path.join(project, "opendomain/integrations/profiles/local.yaml"), `schema_version: "1.0"
id: local-profile
source_type: structured-feature
source_unit:
  kind: file
  match:
    paths:
      - features/**
intent:
  id:
    from: primary.id
  name:
    from: primary.name
  status:
    from: primary.status
references:
  mode: native
  affects_domain:
    concepts:
      from: primary.affects.concepts
`, "utf8");
  const externalSpec = path.join(external, "spec.md");
  await writeFile(externalSpec, `---
type: feature_spec
id: spec.external
name: External OpenSpec request
status: proposed
affects_domain:
  concepts:
    - sales.order
---
`, "utf8");

  const result = await buildGroundingRequest(externalSpec, { cwd: project });

  assert.equal(result.errors.length, 0);
  assert.equal(result.request.integration.id, "openspec");
  assert.equal(result.request.integration.selected, "auto");
});

test("Context Budget deterministically estimates complete selected files", async () => {
  const pack = await prepareGroundingPack(FEATURE_PATH, { cwd: ERP_ROOT });
  const requiredEstimate = await estimateFiles(pack.read_first.map((item) => path.join(ERP_ROOT, item.file)));
  const candidateEstimate = await estimateFiles(pack.candidate_boundaries.map((item) => path.join(ERP_ROOT, item.file)));

  assert.deepEqual(pack.context_budget.estimator, {
    id: "chars-div-4",
    version: "1"
  });
  assert.equal(pack.context_budget.advisory, true);
  assert.deepEqual(pack.context_budget.required, requiredEstimate);
  assert.deepEqual(pack.context_budget.optional_candidates, candidateEstimate);
  assert.equal(
    pack.context_budget.total_possible_estimated_tokens,
    requiredEstimate.estimated_tokens + candidateEstimate.estimated_tokens
  );
  assert.equal(pack.context_budget.required.source_count, pack.read_first.length);
  assert.equal(pack.context_budget.optional_candidates.source_count, pack.candidate_boundaries.length);
});

test("prepare and index query share accepted closure IDs for the same root", async () => {
  const pack = await prepareGroundingPack(FEATURE_PATH, { cwd: ERP_ROOT });
  const built = await buildSemanticIndex(undefined, { cwd: ERP_ROOT });
  const directory = await mkdtemp(path.join(os.tmpdir(), "opendomain-protocol-index-"));
  const indexPath = await writeSemanticIndex(built.index, path.join(directory, "index.json"));
  const query = await querySemanticIndex({ id: "sales.order" }, {
    cwd: ERP_ROOT,
    indexPath
  });

  assert.equal(built.errors.length, 0);
  assert.equal(query.errors.length, 0);
  assert.deepEqual(
    pack.read_first.map((item) => item.id).sort(),
    query.accepted_ids
  );
  assert.deepEqual(pack.semantic_closure.policy, query.semantic_closure.policy);
  assert.equal(pack.semantic_closure.policy.id, "opendomain.semantic-closure");
  assert.equal(pack.semantic_closure.policy.version, "1");
});

async function estimateFiles(files) {
  const uniqueFiles = [...new Set(files)].sort();
  let estimatedTokens = 0;
  for (const file of uniqueFiles) {
    estimatedTokens += estimateTextTokens(await readFile(file, "utf8"));
  }
  return {
    source_count: uniqueFiles.length,
    estimated_tokens: estimatedTokens
  };
}

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

function assertRequiredFields(value, fields) {
  for (const field of fields) {
    assert.ok(Object.hasOwn(value, field), `missing required field '${field}'`);
  }
}
