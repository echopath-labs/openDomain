import assert from "node:assert/strict";
import { cp, appendFile, mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  INDEX_SCHEMA,
  buildSemanticIndex,
  querySemanticIndex,
  writeSemanticIndex
} from "../src/indexer.mjs";
import { runCli } from "../src/cli.mjs";

test("index build creates a derived index JSON shape", async () => {
  const indexPath = await tempIndexPath();
  const stdout = memoryStream();
  const stderr = memoryStream();

  const exitCode = await runCli(["index", "build", "examples/erp", "--out", indexPath, "--json"], { stdout, stderr });
  const payload = JSON.parse(stdout.toString());

  assert.equal(exitCode, 0);
  assert.equal(payload.index.schema, INDEX_SCHEMA);
  assert.equal(payload.errors.length, 0);
  assert.ok(payload.index.entries.some((entry) => entry.id === "sales.order"));
  assert.ok(payload.index.entries.every((entry) => entry.source_file && entry.source_hash));
  assert.ok(payload.index.entries.find((entry) => entry.id === "sales.order").referencing_feature_specs.includes("spec.order-cancellation"));
  assert.match(payload.index.authoritative_source, /source files/);
});

test("index query returns read-first plan and Candidate boundaries", async () => {
  const indexPath = await tempIndexPath();
  await runCli(["index", "build", "examples/erp", "--out", indexPath, "--json"], {
    stdout: memoryStream(),
    stderr: memoryStream()
  });

  const stdout = memoryStream();
  const stderr = memoryStream();
  const exitCode = await runCli(["index", "query", "sales.order", "--index", indexPath, "--json"], { stdout, stderr });
  const payload = JSON.parse(stdout.toString());

  assert.equal(exitCode, 0);
  assert.equal(payload.source_files_authoritative, true);
  assert.ok(payload.accepted_ids.includes("sales.order"));
  assert.ok(payload.accepted_ids.includes("sales.order-lifecycle"));
  assert.ok(payload.read_first.some((item) => item.source_file.endsWith("sales.order.md")));
  assert.ok(payload.candidate_boundaries.some((item) => item.id === "candidate-0001-order-lifecycle" && item.confidence === "medium"));
  assert.equal(payload.errors.length, 0);
});

test("index query can return a context read-first plan", async () => {
  const indexPath = await tempIndexPath();
  await runCli(["index", "build", "examples/erp", "--out", indexPath, "--json"], {
    stdout: memoryStream(),
    stderr: memoryStream()
  });

  const stdout = memoryStream();
  const stderr = memoryStream();
  const exitCode = await runCli(["index", "query", "--context", "sales", "--index", indexPath, "--json"], { stdout, stderr });
  const payload = JSON.parse(stdout.toString());

  assert.equal(exitCode, 0);
  assert.ok(payload.accepted_ids.includes("sales"));
  assert.ok(payload.accepted_ids.includes("sales.order"));
  assert.ok(payload.accepted_ids.includes("sales.confirmed-order-cannot-be-deleted"));
  assert.ok(payload.candidate_boundaries.some((item) => item.target_id === "sales.order-lifecycle"));
});

test("index query warns when source file changed after build", async () => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "opendomain-index-fixture-"));
  await cp(path.join(process.cwd(), "examples"), path.join(fixtureRoot, "examples"), { recursive: true });

  const build = await buildSemanticIndex("examples/erp", {
    cwd: fixtureRoot,
    now: new Date("2026-07-03T00:00:00Z")
  });
  assert.equal(build.errors.length, 0);

  const indexFile = await writeSemanticIndex(build.index, "index.json", { cwd: fixtureRoot });
  await appendFile(path.join(fixtureRoot, "examples/erp/opendomain/concepts/sales.order.md"), "\n");

  const query = await querySemanticIndex({ id: "sales.order" }, {
    cwd: fixtureRoot,
    indexPath: indexFile
  });

  assert.equal(query.errors.length, 0);
  assert.ok(query.warnings.some((warning) => warning.problem.includes("sales.order")));
  assert.ok(query.warnings.some((warning) => warning.fix.includes("index build")));
});

async function tempIndexPath() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "opendomain-index-"));
  return path.join(directory, "index.json");
}

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
