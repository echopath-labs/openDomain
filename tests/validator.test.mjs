import assert from "node:assert/strict";
import test from "node:test";
import { validatePath } from "../src/validator.mjs";

test("valid ERP grounding example passes", async () => {
  const result = await validatePath("examples/erp", {
    cwd: process.cwd(),
    now: new Date("2026-07-03T00:00:00Z")
  });

  assert.equal(result.errors.length, 0);
  assert.ok(result.documents.some((document) => document.id === "spec.order-cancellation"));
  assert.ok(result.documents.some((document) => document.id === "sales.order-lifecycle"));
});

test("OpenDomain self model validates as real domain knowledge", async () => {
  const result = await validatePath("opendomain", {
    cwd: process.cwd(),
    now: new Date("2026-07-03T00:00:00Z")
  });

  assert.equal(result.errors.length, 0);
  assert.ok(result.documents.some((document) => document.id === "opendomain.domain-knowledge"));
  assert.ok(result.documents.some((document) => document.id === "candidate-0002-semantic-retrieval-index"));
});

test("duplicate ids fail", async () => {
  const result = await validatePath("tests/fixtures/invalid/duplicate-id", { cwd: process.cwd() });

  assert.ok(result.errors.some((issue) => issue.problem.includes("Duplicate id 'sales'")));
});

test("broken references fail", async () => {
  const result = await validatePath("tests/fixtures/invalid/broken-reference", { cwd: process.cwd() });

  assert.ok(result.errors.some((issue) => issue.problem.includes("Broken reference 'sales.missing-rule'")));
});

test("accepted knowledge without review metadata fails", async () => {
  const result = await validatePath("tests/fixtures/invalid/accepted-without-review", { cwd: process.cwd() });

  assert.deepEqual(
    result.errors.map((issue) => issue.field),
    ["review.reviewed_at", "review.reviewed_by"]
  );
});

test("candidate without evidence fails", async () => {
  const result = await validatePath("tests/fixtures/invalid/candidate-without-evidence", { cwd: process.cwd() });

  assert.ok(result.errors.some((issue) => issue.field === "evidence"));
});

test("final candidate review without reason fails", async () => {
  const result = await validatePath("tests/fixtures/invalid/candidate-final-without-review-reason", { cwd: process.cwd() });

  assert.ok(result.errors.some((issue) => issue.field === "review" && issue.problem.includes("Final Candidate review decisions")));
});

test("broken affects_domain references fail", async () => {
  const result = await validatePath("tests/fixtures/invalid/broken-affects-domain", { cwd: process.cwd() });

  assert.ok(result.errors.some((issue) => issue.problem.includes("Broken affects_domain reference 'sales.missing-rule'")));
});

test("stale candidates warn without failing validation", async () => {
  const result = await validatePath("examples/erp", {
    cwd: process.cwd(),
    now: new Date("2026-08-15T00:00:00Z")
  });

  assert.equal(result.errors.length, 0);
  assert.ok(result.warnings.some((issue) => issue.problem.includes("Candidate has been proposed")));
});

test("inherited front matter fields cannot satisfy validation", async () => {
  const result = await validatePath("tests/fixtures/invalid/inherited-frontmatter", {
    cwd: process.cwd()
  });

  assert.equal(result.documents.length, 0);
  assert.ok(result.errors.some((issue) => (
    issue.file.endsWith("injected.md")
    && issue.field === "$"
    && issue.problem.includes("__proto__")
  )));
});

test("schema-invalid accepted Rule is excluded from the validated corpus", async () => {
  const result = await validatePath("tests/fixtures/invalid/schema-invalid-rule/domain", {
    cwd: process.cwd()
  });

  assert.deepEqual(
    result.errors.map((issue) => issue.field),
    ["applies_to", "id", "name", "review.reviewed_at", "rule_type", "severity"]
  );
  assert.ok(result.errors.every((issue) => (
    issue.file.endsWith("invalid-rule.md")
    && issue.problem.includes("rule.schema.json")
    && issue.fix.includes("schemas/rule.schema.json")
  )));
  assert.equal(result.documents.some((document) => document.id === "BAD"), false);
  assert.equal(result.documents.some((document) => document.id === "sales"), true);
});

test("schema-invalid nested metadata is excluded from the validated corpus", async () => {
  const result = await validatePath("tests/fixtures/invalid/schema-invalid-nested", {
    cwd: process.cwd()
  });

  assert.equal(result.documents.length, 0);
  assert.deepEqual(result.errors.map((issue) => issue.field), ["review"]);
  assert.match(result.errors[0].problem, /must be object/);
});

test("missing and unsupported types cannot enter the validated corpus", async () => {
  const result = await validatePath("tests/fixtures/invalid/unsupported-types", {
    cwd: process.cwd()
  });

  assert.equal(result.documents.length, 0);
  assert.equal(result.errors.length, 3);
  assert.ok(result.errors.every((issue) => issue.field === "type"));
  assert.ok(result.errors.some((issue) => issue.problem.includes("Missing required field")));
  assert.ok(result.errors.some((issue) => issue.problem.includes("Unsupported type")));
  assert.ok(result.errors.some((issue) => issue.problem.includes("received object")));
});

test("current corpus includes valid controls for every domain source schema", async () => {
  const result = await validatePath(undefined, { cwd: process.cwd() });
  const types = new Set(result.documents.map((document) => document.type));

  assert.equal(result.errors.length, 0);
  for (const type of [
    "bounded_context",
    "domain_concept",
    "business_rule",
    "lifecycle",
    "domain_event",
    "domain_candidate"
  ]) {
    assert.equal(types.has(type), true, `Missing valid runtime schema control for ${type}`);
  }
});
