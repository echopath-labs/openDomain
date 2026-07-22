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
  const result = await validatePath("domain", {
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

  assert.ok(result.errors.some((issue) => issue.field === "review"));
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
