import assert from "node:assert/strict";
import test from "node:test";
import { runCli } from "../src/cli.mjs";

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

test("order cancellation demo explains the avoided semantic error", async () => {
  const stdout = memoryStream();
  const stderr = memoryStream();

  const exitCode = await runCli(["demo", "order-cancellation"], { stdout, stderr });
  const output = stdout.toString();

  assert.equal(exitCode, 0);
  assert.match(output, /Do not add direct deletion behavior for confirmed orders/);
  assert.match(output, /Candidate until human review/);
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
  assert.ok(payload.read_first.some((item) => item.id === "sales.order"));
  assert.ok(payload.candidate_boundaries.some((item) => item.id === "candidate-0001-order-lifecycle"));
  assert.equal(payload.errors.length, 0);
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
