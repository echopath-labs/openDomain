import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  CONTEXT_EXPORT_SCHEMA,
  CONTEXT_QUERY_SCHEMA,
  CORE_API_VERSION,
  exportContext,
  queryWorkspace,
  validateWorkspace
} from "../src/core.mjs";
import { runCli } from "../src/cli.mjs";
import { validateContextExportEnvelope } from "../src/context-export-schema.mjs";
import { validatePath } from "../src/validator.mjs";

const REPOSITORY_ROOT = path.resolve(".");
const ERP_TARGET = "examples/erp";
const GOVERNED_ROOT = path.resolve("tests/fixtures/valid/governed-multi-product");
const NOW = new Date("2026-08-10T00:00:00Z");

test("package root and core subpath expose one versioned side-effect-free API", async () => {
  const root = await import("@echopath-labs/opendomain");
  const subpath = await import("@echopath-labs/opendomain/core");
  assert.equal(root.CORE_API_VERSION, "1.0");
  assert.equal(subpath.CORE_API_VERSION, root.CORE_API_VERSION);
  assert.equal(subpath.validateWorkspace, root.validateWorkspace);
  assert.equal(subpath.queryWorkspace, root.queryWorkspace);
  assert.equal(subpath.exportContext, root.exportContext);

  const previousExitCode = process.exitCode;
  const result = await root.queryWorkspace({
    target: ERP_TARGET,
    selector: { id: "sales.order" },
    cwd: REPOSITORY_ROOT,
    now: NOW
  });
  assert.equal(result.status, "pass");
  assert.equal(process.exitCode, previousExitCode);
  await assert.rejects(
    access(path.join(REPOSITORY_ROOT, "examples/erp/.opendomain/index.json")),
    (error) => error?.code === "ENOENT"
  );
});

test("Core validation delegates to the established validator without changing its result", async () => {
  const core = await validateWorkspace({
    target: ERP_TARGET,
    cwd: REPOSITORY_ROOT,
    now: NOW
  });
  const established = await validatePath(ERP_TARGET, {
    cwd: REPOSITORY_ROOT,
    now: NOW
  });
  assert.deepEqual(core, established);
});

test("source-first query returns a deterministic accepted closure and Candidate boundary", async () => {
  const first = await queryWorkspace({
    target: ERP_TARGET,
    selector: { id: "sales.order" },
    cwd: REPOSITORY_ROOT,
    now: NOW
  });
  const second = await queryWorkspace({
    target: ERP_TARGET,
    selector: { id: "sales.order" },
    cwd: REPOSITORY_ROOT,
    now: NOW
  });

  assert.deepEqual(first, second);
  assert.equal(first.schema, CONTEXT_QUERY_SCHEMA);
  assert.equal(first.api_version, CORE_API_VERSION);
  assert.equal(first.status, "pass");
  assert.ok(first.accepted_ids.includes("sales.order-lifecycle"));
  assert.deepEqual(first.candidate_boundaries.map((item) => item.id), [
    "candidate-0001-order-lifecycle"
  ]);
});

test("context export is schema-valid, portable, accepted-only, and Candidate-safe", async () => {
  const result = await exportContext({
    target: ERP_TARGET,
    selector: { id: "sales.order" },
    cwd: REPOSITORY_ROOT,
    now: NOW
  });

  assert.equal(result.schema, CONTEXT_EXPORT_SCHEMA);
  assert.equal(result.status, "pass");
  assert.deepEqual(validateContextExportEnvelope(result), { valid: true, errors: [] });
  assert.ok(result.documents.every((document) => document.status === "accepted"));
  assert.ok(result.documents.every((document) => document.authoritative === true));
  assert.ok(result.documents.every((document) => !path.isAbsolute(document.source.file)));
  assert.ok(result.documents.every((document) => document.source.hash.length === 64));
  assert.equal(result.documents.find((document) => document.id === "sales.order").body.includes("# Order"), true);
  assert.deepEqual(result.candidate_boundaries.map((candidate) => ({
    id: candidate.id,
    authoritative: candidate.authoritative
  })), [{ id: "candidate-0001-order-lifecycle", authoritative: false }]);
});

test("Candidate id remains a non-authoritative boundary in a failed export", async () => {
  const result = await exportContext({
    target: ERP_TARGET,
    selector: { id: "candidate-0001-order-lifecycle" },
    cwd: REPOSITORY_ROOT,
    now: NOW
  });

  assert.equal(result.status, "fail");
  assert.deepEqual(result.documents, []);
  assert.deepEqual(result.candidate_boundaries.map((candidate) => candidate.id), [
    "candidate-0001-order-lifecycle"
  ]);
  assert.equal(result.candidate_boundaries[0].authoritative, false);
  assert.deepEqual(validateContextExportEnvelope(result), { valid: true, errors: [] });
});

test("public export preserves complete current closure proof and excludes stricter groups", async () => {
  const result = await exportContext({
    selector: { product: "alpha" },
    exposure: "public",
    cwd: GOVERNED_ROOT,
    now: NOW
  });

  assert.equal(result.status, "pass");
  assert.deepEqual(result.documents.map((document) => document.id), ["alpha", "beta"]);
  assert.ok(result.documents.every((document) => document.governance.exposure === "public"));
  assert.deepEqual(result.governance.publication_closure.domain_group_ids, [
    "alpha.public",
    "beta.public"
  ]);
  assert.equal(JSON.stringify(result).includes("alpha_private"), false);
  assert.deepEqual(validateContextExportEnvelope(result), { valid: true, errors: [] });
});

test("public export fails closed for ungoverned, unknown, and cropped requests", async () => {
  const ungoverned = await exportContext({
    target: ERP_TARGET,
    selector: { product: "alpha" },
    exposure: "public",
    cwd: REPOSITORY_ROOT,
    now: NOW
  });
  assert.equal(ungoverned.status, "fail");
  assert.deepEqual(ungoverned.documents, []);
  assert.match(ungoverned.errors[0].problem, /requires a governed canonical workspace/);

  const unknown = await exportContext({
    selector: { product: "missing" },
    exposure: "public",
    cwd: GOVERNED_ROOT,
    now: NOW
  });
  assert.equal(unknown.status, "fail");
  assert.deepEqual(unknown.documents, []);

  const cropped = await exportContext({
    selector: { product: "alpha", context: "alpha" },
    exposure: "public",
    cwd: GOVERNED_ROOT,
    now: NOW
  });
  assert.equal(cropped.status, "fail");
  assert.deepEqual(cropped.documents, []);
  assert.ok(cropped.errors.some((error) => error.problem.includes("cannot crop")));
});

test("CLI JSON and library results are deeply equivalent with a fixed clock", async () => {
  const cases = [
    {
      cwd: REPOSITORY_ROOT,
      args: ["query", ERP_TARGET, "--id", "sales.order", "--json"],
      library: () => queryWorkspace({
        target: ERP_TARGET,
        selector: { id: "sales.order" },
        cwd: REPOSITORY_ROOT,
        now: NOW
      })
    },
    {
      cwd: REPOSITORY_ROOT,
      args: ["export", "context", ERP_TARGET, "--id", "sales.order", "--json"],
      library: () => exportContext({
        target: ERP_TARGET,
        selector: { id: "sales.order" },
        cwd: REPOSITORY_ROOT,
        now: NOW
      })
    },
    {
      cwd: GOVERNED_ROOT,
      args: ["export", "context", "--product", "alpha", "--exposure", "public", "--json"],
      library: () => exportContext({
        selector: { product: "alpha" },
        exposure: "public",
        cwd: GOVERNED_ROOT,
        now: NOW
      })
    },
    {
      cwd: REPOSITORY_ROOT,
      args: ["query", ERP_TARGET, "--id", "missing", "--json"],
      library: () => queryWorkspace({
        target: ERP_TARGET,
        selector: { id: "missing" },
        cwd: REPOSITORY_ROOT,
        now: NOW
      })
    }
  ];

  for (const entry of cases) {
    const stdout = memoryStream();
    const exitCode = await runCli(entry.args, {
      cwd: entry.cwd,
      now: NOW,
      stdout,
      stderr: memoryStream()
    });
    const cli = JSON.parse(stdout.toString());
    const library = await entry.library();
    assert.deepEqual(cli, library);
    assert.equal(exitCode, library.errors.length > 0 ? 1 : 0);
  }
});

test("human query and export output are derived from Core status and boundaries", async () => {
  const queryOut = memoryStream();
  assert.equal(await runCli(["query", ERP_TARGET, "--id", "sales.order"], {
    cwd: REPOSITORY_ROOT,
    now: NOW,
    stdout: queryOut,
    stderr: memoryStream()
  }), 0);
  assert.match(queryOut.toString(), /OpenDomain Source-First Query/);
  assert.match(queryOut.toString(), /Candidate boundaries: 1/);

  const exportOut = memoryStream();
  assert.equal(await runCli(["export", "context", "--product", "alpha", "--exposure", "public"], {
    cwd: GOVERNED_ROOT,
    now: NOW,
    stdout: exportOut,
    stderr: memoryStream()
  }), 0);
  assert.match(exportOut.toString(), /Publication closure: pass/);
  assert.match(exportOut.toString(), /no publication performed/);
});

function memoryStream() {
  let output = "";
  return {
    write(chunk) {
      output += chunk;
    },
    toString() {
      return output;
    }
  };
}
