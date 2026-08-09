import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { runCli } from "../src/cli.mjs";
import { buildSemanticIndex } from "../src/indexer.mjs";
import { validatePath } from "../src/validator.mjs";

const FIXTURE_ROOT = path.resolve("tests/fixtures/valid/governed-multi-product");

test("validator exposes deterministic governed publication evidence", async () => {
  const first = await validatePath(undefined, { cwd: FIXTURE_ROOT });
  const second = await validatePath(undefined, { cwd: FIXTURE_ROOT });

  assert.deepEqual(first, second);
  assert.equal(first.errors.length, 0);
  assert.equal(first.workspace.governed, true);
  assert.equal(first.governance.schema_version, "1.0");
  assert.deepEqual(first.governance.publication_closures.map((closure) => closure.product_id), [
    "alpha",
    "beta"
  ]);
  const alpha = first.governance.publication_closures.find((closure) => closure.product_id === "alpha");
  assert.deepEqual(alpha.domain_group_ids, ["alpha.public", "beta.public"]);
  assert.equal(alpha.source_files.some((file) => file.includes("alpha.private")), false);
  assert.ok(first.documents.every((document) => document.ownership));
});

test("governed semantic index preserves ownership and derived publication provenance", async () => {
  const result = await buildSemanticIndex(undefined, {
    cwd: FIXTURE_ROOT,
    now: new Date("2026-08-10T00:00:00Z")
  });

  assert.equal(result.errors.length, 0);
  assert.equal(result.index.governance.schema_version, "1.0");
  assert.equal(result.index.governance.derived, true);
  assert.match(result.index.governance.authoritative_source, /manifest and semantic source files/);
  const alpha = result.index.entries.find((entry) => entry.id === "alpha");
  assert.equal(alpha.product_id, "alpha");
  assert.equal(alpha.domain_group_id, "alpha.public");
  assert.equal(alpha.exposure, "public");
  assert.deepEqual(alpha.owners, ["alpha-owner"]);
});

test("ungoverned semantic index keeps the pre-governance entry shape", async () => {
  const result = await buildSemanticIndex("examples/erp", {
    cwd: process.cwd(),
    now: new Date("2026-08-10T00:00:00Z")
  });

  assert.equal(result.errors.length, 0);
  assert.equal(Object.hasOwn(result.index, "governance"), false);
  assert.equal(Object.hasOwn(result.index.entries[0], "product_id"), false);
  assert.equal(Object.hasOwn(result.index.entries[0], "domain_group_id"), false);
});

test("CLI human and JSON validation expose the same governed result without mutation", async (context) => {
  const before = await readFile(path.join(FIXTURE_ROOT, "opendomain/governance.yaml"), "utf8");
  const jsonOut = memoryStream();
  const jsonCode = await runCli(["validate", "--json"], {
    cwd: FIXTURE_ROOT,
    stdout: jsonOut,
    stderr: memoryStream()
  });
  const payload = JSON.parse(jsonOut.toString());
  const humanOut = memoryStream();
  const humanCode = await runCli(["validate"], {
    cwd: FIXTURE_ROOT,
    stdout: humanOut,
    stderr: memoryStream()
  });
  const after = await readFile(path.join(FIXTURE_ROOT, "opendomain/governance.yaml"), "utf8");

  assert.equal(jsonCode, 0);
  assert.equal(humanCode, 0);
  assert.equal(payload.errors.length, 0);
  assert.match(humanOut.toString(), /2 products, 5 domain groups, 2 public closures passed/);
  assert.match(humanOut.toString(), /no publication performed/);
  assert.equal(after, before);

  const temporary = await mkdtemp(path.join(os.tmpdir(), "opendomain-governed-no-git-"));
  context.after(() => rm(temporary, { recursive: true, force: true }));
  assert.equal(await pathExists(path.join(temporary, ".git")), false);
});

async function pathExists(file) {
  try {
    await readFile(file);
    return true;
  } catch {
    return false;
  }
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
