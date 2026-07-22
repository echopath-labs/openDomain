import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { runCli } from "../src/cli.mjs";
import { parseMarkdown } from "../src/frontmatter.mjs";

test("validate command returns JSON and zero exit code for valid ERP example", async () => {
  const stdout = memoryStream();
  const stderr = memoryStream();

  const exitCode = await runCli(["validate", "examples/erp", "--json"], { stdout, stderr });
  const payload = JSON.parse(stdout.toString());

  assert.equal(exitCode, 0);
  assert.equal(payload.errors.length, 0);
  assert.ok(payload.documents.some((document) => document.id === "spec.order-cancellation"));
});

test("validate command returns non-zero for invalid fixture", async () => {
  const stdout = memoryStream();
  const stderr = memoryStream();

  const exitCode = await runCli(["validate", "tests/fixtures/invalid/broken-reference"], { stdout, stderr });

  assert.equal(exitCode, 1);
  assert.match(stdout.toString(), /Broken reference 'sales\.missing-rule'/);
});

test("validate command returns structured front matter security diagnostics", async () => {
  const stdout = memoryStream();
  const stderr = memoryStream();

  const exitCode = await runCli([
    "validate",
    "tests/fixtures/invalid/inherited-frontmatter",
    "--json"
  ], { stdout, stderr });
  const payload = JSON.parse(stdout.toString());

  assert.equal(exitCode, 1);
  assert.equal(payload.documents.length, 0);
  assert.ok(payload.errors.some((issue) => (
    issue.file.endsWith("injected.md")
    && issue.field === "$"
    && issue.problem.includes("__proto__")
  )));
});

test("validate command reports deterministic runtime schema diagnostics", async () => {
  const stdout = memoryStream();
  const stderr = memoryStream();

  const exitCode = await runCli([
    "validate",
    "tests/fixtures/invalid/schema-invalid-rule/domain",
    "--json"
  ], { stdout, stderr });
  const payload = JSON.parse(stdout.toString());

  assert.equal(exitCode, 1);
  assert.deepEqual(
    payload.errors.map((issue) => issue.field),
    ["applies_to", "id", "name", "review.reviewed_at", "rule_type", "severity"]
  );
  assert.equal(payload.documents.some((document) => document.id === "BAD"), false);
});

test("order cancellation demo explains the avoided semantic error", async () => {
  const stdout = memoryStream();
  const stderr = memoryStream();

  const exitCode = await runCli(["demo", "order-cancellation"], { stdout, stderr });
  const output = stdout.toString();

  assert.equal(exitCode, 0);
  assert.match(output, /Do not add direct deletion behavior for confirmed orders/);
  assert.match(output, /Candidate until human review/);
});

test("init command creates a minimal valid OpenDomain structure", async () => {
  await withTempCwd(async () => {
    const stdout = memoryStream();
    const stderr = memoryStream();

    const exitCode = await runCli(["init"], { stdout, stderr });
    const output = stdout.toString();

    assert.equal(exitCode, 0);
    assert.match(output, /OpenDomain init completed/);
    assert.match(output, /domain\/contexts\/example\.md/);
    assert.match(output, /domain\/concepts\/example\.concept\.md/);
    assert.match(output, /domain\/candidates\/candidate-0001-first-domain-model\.md/);

    const validateStdout = memoryStream();
    const validateExitCode = await runCli(["validate", "domain", "--json"], { stdout: validateStdout, stderr: memoryStream() });
    const payload = JSON.parse(validateStdout.toString());

    assert.equal(validateExitCode, 0);
    assert.equal(payload.errors.length, 0);
    assert.ok(payload.documents.some((document) => document.id === "example"));
    assert.ok(payload.documents.some((document) => document.id === "example.concept"));
    assert.ok(payload.documents.some((document) => document.id === "candidate-0001-first-domain-model"));
  });
});

test("init command does not overwrite existing files", async () => {
  await withTempCwd(async () => {
    await mkdir("domain/contexts", { recursive: true });
    await writeFile("domain/contexts/example.md", "existing content\n", "utf8");

    const stdout = memoryStream();
    const stderr = memoryStream();

    const exitCode = await runCli(["init"], { stdout, stderr });
    const output = stdout.toString();
    const existing = await readFile("domain/contexts/example.md", "utf8");

    assert.equal(exitCode, 0);
    assert.equal(existing, "existing content\n");
    assert.match(output, /domain\/contexts\/example\.md \(already exists\)/);
  });
});

test("init command can copy the ERP example", async () => {
  await withTempCwd(async () => {
    const stdout = memoryStream();
    const stderr = memoryStream();

    const exitCode = await runCli(["init", "--example", "erp"], { stdout, stderr });
    const output = stdout.toString();

    assert.equal(exitCode, 0);
    assert.match(output, /Example: erp/);
    assert.match(output, /examples\/erp\/domain\/concepts\/sales\.order\.md/);

    const validateStdout = memoryStream();
    const validateExitCode = await runCli(["validate", "examples/erp", "--json"], { stdout: validateStdout, stderr: memoryStream() });
    const payload = JSON.parse(validateStdout.toString());

    assert.equal(validateExitCode, 0);
    assert.equal(payload.errors.length, 0);
    assert.ok(payload.documents.some((document) => document.id === "sales.order"));
  });
});

test("prepare command returns grounding pack for a feature spec", async () => {
  const stdout = memoryStream();
  const stderr = memoryStream();

  const exitCode = await runCli(["prepare", "examples/erp/openspec/changes/order-cancellation/spec.md"], { stdout, stderr });
  const output = stdout.toString();

  assert.equal(exitCode, 0);
  assert.match(output, /Domain Grounding Pack/);
  assert.match(output, /sales\.order-lifecycle/);
  assert.match(output, /candidate-0001-order-lifecycle/);
  assert.match(output, /Do not add direct deletion behavior for confirmed orders/);
  assert.match(output, /Domain Grounding Used/);
});

test("prepare command returns JSON grounding pack", async () => {
  const stdout = memoryStream();
  const stderr = memoryStream();

  const exitCode = await runCli(["prepare", "examples/erp/openspec/changes/order-cancellation/spec.md", "--json"], { stdout, stderr });
  const payload = JSON.parse(stdout.toString());

  assert.equal(exitCode, 0);
  assert.equal(payload.feature.id, "spec.order-cancellation");
  assert.equal(payload.grounding_request.integration.id, "openspec");
  assert.equal(payload.grounding_request.integration.kind, "builtin");
  assert.equal(payload.grounding_request.source.type, "openspec");
  assert.equal(payload.grounding_request.intent.id, "spec.order-cancellation");
  assert.ok(payload.read_first.some((item) => item.id === "sales.order"));
  assert.ok(payload.candidate_boundaries.some((item) => item.id === "candidate-0001-order-lifecycle"));
  assert.equal(payload.errors.length, 0);
});

test("prepare command supports explicit OpenSpec integration", async () => {
  const stdout = memoryStream();
  const stderr = memoryStream();

  const exitCode = await runCli([
    "prepare",
    "--integration",
    "openspec",
    "examples/erp/openspec/changes/order-cancellation/spec.md",
    "--json"
  ], { stdout, stderr });
  const payload = JSON.parse(stdout.toString());

  assert.equal(exitCode, 0);
  assert.equal(payload.grounding_request.integration.id, "openspec");
  assert.equal(payload.grounding_request.integration.selected, "openspec");
  assert.equal(payload.feature.id, "spec.order-cancellation");
});

test("prepare command supports trailing explicit OpenSpec integration", async () => {
  const stdout = memoryStream();
  const stderr = memoryStream();

  const exitCode = await runCli([
    "prepare",
    "examples/erp/openspec/changes/order-cancellation/spec.md",
    "--integration",
    "openspec",
    "--json"
  ], { stdout, stderr });
  const payload = JSON.parse(stdout.toString());

  assert.equal(exitCode, 0);
  assert.equal(payload.grounding_request.integration.selected, "openspec");
  assert.equal(payload.feature.id, "spec.order-cancellation");
});

test("prepare command rejects unsupported integrations", async () => {
  const stdout = memoryStream();
  const stderr = memoryStream();

  const exitCode = await runCli([
    "prepare",
    "--integration",
    "spec-kit",
    "examples/erp/openspec/changes/order-cancellation/spec.md"
  ], { stdout, stderr });
  const output = stdout.toString();

  assert.equal(exitCode, 1);
  assert.match(output, /Unsupported integration 'spec-kit'/);
  assert.match(output, /Use --integration openspec/);
});

test("prepare command accepts a directory containing one feature spec", async () => {
  const stdout = memoryStream();
  const stderr = memoryStream();

  const exitCode = await runCli(["prepare", "examples/erp/openspec/changes/order-cancellation"], { stdout, stderr });

  assert.equal(exitCode, 0);
  assert.match(stdout.toString(), /Feature: spec\.order-cancellation/);
});

test("prepare command works for the OpenDomain self model", async () => {
  const stdout = memoryStream();
  const stderr = memoryStream();

  const exitCode = await runCli(["prepare", "domain/openspec/changes/self-model-maintenance/spec.md"], { stdout, stderr });
  const output = stdout.toString();

  assert.equal(exitCode, 0);
  assert.match(output, /spec\.opendomain-self-model-maintenance/);
  assert.match(output, /opendomain\.domain-knowledge/);
  assert.match(output, /candidate-0002-semantic-retrieval-index/);
});

test("prepare command fails when no feature spec exists", async () => {
  const stdout = memoryStream();
  const stderr = memoryStream();

  const exitCode = await runCli(["prepare", "examples/erp/domain"], { stdout, stderr });

  assert.equal(exitCode, 1);
  assert.match(stdout.toString(), /No feature_spec found/);
});

test("prepare command fails on broken affects_domain references", async () => {
  const stdout = memoryStream();
  const stderr = memoryStream();

  const exitCode = await runCli(["prepare", "tests/fixtures/invalid/broken-affects-domain/openspec/changes/order-cancellation/spec.md"], { stdout, stderr });

  assert.equal(exitCode, 1);
  assert.match(stdout.toString(), /Broken affects_domain reference 'sales\.missing-rule'/);
});

test("candidate list returns candidate summaries", async () => {
  const stdout = memoryStream();
  const stderr = memoryStream();

  const exitCode = await runCli(["candidate", "list", "examples/erp", "--json"], { stdout, stderr });
  const payload = JSON.parse(stdout.toString());

  assert.equal(exitCode, 0);
  assert.equal(payload.errors.length, 0);
  assert.ok(payload.candidates.some((candidate) => (
    candidate.id === "candidate-0001-order-lifecycle"
    && candidate.status === "proposed"
    && candidate.target.id === "sales.order-lifecycle"
  )));
});

test("candidate show states that candidate is not accepted knowledge", async () => {
  const stdout = memoryStream();
  const stderr = memoryStream();

  const exitCode = await runCli(["candidate", "show", "candidate-0001-order-lifecycle", "examples/erp"], { stdout, stderr });
  const output = stdout.toString();

  assert.equal(exitCode, 0);
  assert.match(output, /Domain Candidate: candidate-0001-order-lifecycle/);
  assert.match(output, /Candidate is not accepted OpenDomain knowledge/);
  assert.match(output, /Existing accepted lifecycle does not include Closed/);
});

test("candidate review records rejected decision metadata", async () => {
  await withTempCwd(async () => {
    await writeCandidate("candidate-1000-review");

    const stdout = memoryStream();
    const stderr = memoryStream();
    const exitCode = await runCli([
      "candidate",
      "review",
      "candidate-1000-review",
      "--decision",
      "rejected",
      "--reviewed-by",
      "Chase",
      "--reviewed-at",
      "2026-07-08",
      "--reason",
      "Evidence does not support the proposed concept.",
      "domain",
      "--json"
    ], { stdout, stderr });
    const payload = JSON.parse(stdout.toString());
    const file = await readFile("domain/candidates/candidate-1000-review.md", "utf8");

    assert.equal(exitCode, 0);
    assert.equal(payload.effective_state, "rejected");
    assert.match(file, /status: rejected/);
    assert.match(file, /state: rejected/);
    assert.match(file, /reviewed_by: Chase/);
    assert.match(file, /decision_reason: Evidence does not support the proposed concept\./);

    const validateStdout = memoryStream();
    const validateExitCode = await runCli(["validate", "domain", "--json"], { stdout: validateStdout, stderr: memoryStream() });
    const validatePayload = JSON.parse(validateStdout.toString());

    assert.equal(validateExitCode, 0);
    assert.equal(validatePayload.errors.length, 0);
  });
});

test("candidate accepted review maps to superseded without modifying accepted knowledge", async () => {
  await withTempCwd(async () => {
    await writeCandidate("candidate-1001-accepted");

    const stdout = memoryStream();
    const stderr = memoryStream();
    const exitCode = await runCli([
      "candidate",
      "review",
      "candidate-1001-accepted",
      "--decision",
      "accepted",
      "--reviewed-by",
      "Chase",
      "--reviewed-at",
      "2026-07-08",
      "--reason",
      "Human accepted the candidate; accepted source files will be updated manually.",
      "domain"
    ], { stdout, stderr });
    const output = stdout.toString();
    const file = await readFile("domain/candidates/candidate-1001-accepted.md", "utf8");

    assert.equal(exitCode, 0);
    assert.match(output, /Decision: accepted/);
    assert.match(output, /Recorded state: superseded/);
    assert.match(output, /accepted OpenDomain source files/);
    assert.match(file, /status: superseded/);
    assert.match(file, /state: superseded/);
  });
});

test("candidate review safely round trips YAML-like decision metadata and body", async () => {
  await withTempCwd(async () => {
    const id = "candidate-1004-roundtrip";
    const reason = "Evidence says \"true, null\": keep [draft], #1.";
    await writeCandidate(id, {
      possibleConflicts: ["true", "Value, with comma"],
      body: "# Candidate Fixture\n\nBody: keep [brackets], commas, and \"quotes\" unchanged.\n"
    });
    const before = parseMarkdown(
      await readFile(`domain/candidates/${id}.md`, "utf8"),
      `domain/candidates/${id}.md`
    );

    const stdout = memoryStream();
    const stderr = memoryStream();
    const exitCode = await runCli([
      "candidate",
      "review",
      id,
      "--decision",
      "rejected",
      "--reviewed-by",
      "Chase: Domain Owner",
      "--reviewed-at",
      "2026-07-22",
      "--reason",
      reason,
      "domain",
      "--json"
    ], { stdout, stderr });
    const payload = JSON.parse(stdout.toString());
    const content = await readFile(`domain/candidates/${id}.md`, "utf8");
    const after = parseMarkdown(content, `domain/candidates/${id}.md`);

    assert.equal(exitCode, 0);
    assert.equal(payload.errors.length, 0);
    assert.equal(after.frontmatter.review.reviewed_by, "Chase: Domain Owner");
    assert.equal(after.frontmatter.review.decision_reason, reason);
    assert.deepEqual(after.frontmatter.possible_conflicts, ["true", "Value, with comma"]);
    assert.equal(after.frontmatter.target.id, before.frontmatter.target.id);
    assert.equal(after.frontmatter.evidence[0].summary, before.frontmatter.evidence[0].summary);
    assert.equal(after.body, before.body);

    const validateStdout = memoryStream();
    const validateExitCode = await runCli(["validate", "domain", "--json"], {
      stdout: validateStdout,
      stderr: memoryStream()
    });
    const validatePayload = JSON.parse(validateStdout.toString());

    assert.equal(validateExitCode, 0);
    assert.equal(validatePayload.errors.length, 0);
  });
});

test("candidate list handles deprecated and stale candidates", async () => {
  await withTempCwd(async () => {
    await writeCandidate("candidate-1002-deprecated", {
      status: "deprecated",
      reviewedBy: "Chase",
      reviewedAt: "2026-07-08",
      reason: "The proposal is obsolete."
    });
    await writeCandidate("candidate-1003-stale", {
      extractedAt: "2026-01-01"
    });

    const stdout = memoryStream();
    const stderr = memoryStream();
    const exitCode = await runCli(["candidate", "list", "domain", "--json"], { stdout, stderr });
    const payload = JSON.parse(stdout.toString());

    assert.equal(exitCode, 0);
    assert.ok(payload.candidates.some((candidate) => candidate.id === "candidate-1002-deprecated" && candidate.status === "deprecated"));
    assert.ok(payload.warnings.some((warning) => warning.file.includes("candidate-1003-stale")));
  });
});

function memoryStream() {
  let value = "";
  return {
    write(chunk) {
      value += chunk;
    },
    toString() {
      return value;
    }
  };
}

async function withTempCwd(callback) {
  const previous = process.cwd();
  const directory = await mkdtemp(path.join(os.tmpdir(), "opendomain-init-"));
  process.chdir(directory);
  try {
    await callback(directory);
  } finally {
    process.chdir(previous);
    await rm(directory, { recursive: true, force: true });
  }
}

async function writeCandidate(id, options = {}) {
  await mkdir("domain/candidates", { recursive: true });
  const status = options.status ?? "proposed";
  const reviewState = status;
  const extractedAt = options.extractedAt ?? "2026-07-08";
  const reviewLines = [
    "review:",
    `  state: ${reviewState}`,
    "  suggested_reviewer: fixture-reviewer"
  ];
  if (status !== "proposed") {
    reviewLines.push(`  reviewed_by: ${options.reviewedBy ?? "fixture-reviewer"}`);
    reviewLines.push(`  reviewed_at: ${options.reviewedAt ?? "2026-07-08"}`);
    reviewLines.push(`  decision_reason: ${options.reason ?? "Fixture final review decision."}`);
  }
  const possibleConflicts = options.possibleConflicts?.length > 0
    ? `possible_conflicts:\n${options.possibleConflicts.map((value) => `  - ${JSON.stringify(value)}`).join("\n")}\n`
    : "";
  const body = options.body ?? "# Candidate Fixture\n\nFixture candidate for CLI tests.\n";

  await writeFile(`domain/candidates/${id}.md`, `---
type: domain_candidate
id: ${id}
status: ${status}
proposed_change_type: add_concept
target:
  type: domain_concept
  id: example.new-concept
confidence: medium
extracted_by: codex
extracted_at: ${extractedAt}
evidence:
  - type: spec
    location: tests/cli.test.mjs
    summary: Fixture candidate for CLI review workflow.
    confidence: medium
${possibleConflicts}${reviewLines.join("\n")}
---

${body}`, "utf8");
}
