import assert from "node:assert/strict";
import { access, cp, mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { runCli } from "../src/cli.mjs";

const REPOSITORY_ROOT = process.cwd();

test("canonical workspace resolution is shared across every corpus consumer", async () => {
  await withTempProject(async (project) => {
    await seedErpWorkspace(project, "opendomain");
    await mkdir(path.join(project, "examples/ignored"), { recursive: true });
    await writeFile(
      path.join(project, "examples/ignored/not-domain.md"),
      "This default-excluded example has no front matter.\n",
      "utf8"
    );

    const validation = await runJson(["validate", "--json"], project);
    assert.equal(validation.exitCode, 0);
    assert.equal(validation.payload.workspace.mode, "canonical");
    assert.equal(validation.payload.warnings.length, 0);
    assert.equal(validation.payload.documents.some((item) => item.id === "spec.order-cancellation"), false);

    const grounding = await runJson(["prepare", "feature.md", "--json"], project);
    assert.equal(grounding.exitCode, 0);
    assert.equal(grounding.payload.errors.length, 0);
    assert.ok(grounding.payload.read_first.some((item) => item.id === "sales.order"));

    const candidates = await runJson(["candidate", "list", "--json"], project);
    assert.equal(candidates.exitCode, 0);
    assert.equal(candidates.payload.warnings.length, 0);
    assert.ok(candidates.payload.candidates.some((item) => item.id === "candidate-0001-order-lifecycle"));

    const ids = await runJson(["ids", "list", "--json"], project);
    assert.equal(ids.exitCode, 0);
    assert.equal(ids.payload.workspace.mode, "canonical");
    assert.equal(ids.payload.warnings.length, 0);

    const index = await runJson(["index", "build", "--json"], project);
    assert.equal(index.exitCode, 0);
    assert.equal(index.payload.file, "opendomain/generated/index.json");
    assert.equal(index.payload.warnings.length, 0);
    await access(path.join(project, "opendomain/generated/index.json"));

    const query = await runJson(["index", "query", "sales.order", "--json"], project);
    assert.equal(query.exitCode, 0);
    assert.equal(query.payload.index_file, "opendomain/generated/index.json");
    assert.ok(query.payload.accepted_ids.includes("sales.order"));

    const validationAfterIndex = await runJson(["validate", "--json"], project);
    assert.equal(validationAfterIndex.exitCode, 0);
    assert.equal(validationAfterIndex.payload.documents.length, validation.payload.documents.length);
  });
});

test("legacy workspace warnings and index compatibility are shared without creating canonical root", async () => {
  await withTempProject(async (project) => {
    await seedErpWorkspace(project, "domain");

    const validation = await runJson(["validate", "--json"], project);
    assert.equal(validation.exitCode, 0);
    assertLegacyWarning(validation.payload.warnings);

    const grounding = await runJson(["prepare", "feature.md", "--json"], project);
    assert.equal(grounding.exitCode, 0);
    assertLegacyWarning(grounding.payload.warnings);

    const candidates = await runJson(["candidate", "list", "--json"], project);
    assert.equal(candidates.exitCode, 0);
    assertLegacyWarning(candidates.payload.warnings);

    const ids = await runJson(["ids", "list", "--json"], project);
    assert.equal(ids.exitCode, 0);
    assertLegacyWarning(ids.payload.warnings);

    const index = await runJson(["index", "build", "--json"], project);
    assert.equal(index.exitCode, 0);
    assert.equal(index.payload.file, ".opendomain/index.json");
    assertLegacyWarning(index.payload.warnings);
    await access(path.join(project, ".opendomain/index.json"));
    await assert.rejects(access(path.join(project, "opendomain")), { code: "ENOENT" });

    const query = await runJson(["index", "query", "sales.order", "--json"], project);
    assert.equal(query.exitCode, 0);
    assert.equal(query.payload.index_file, ".opendomain/index.json");
    assertLegacyWarning(query.payload.warnings);
  });
});

test("dual-root projects use only canonical sources across corpus consumers", async () => {
  await withTempProject(async (project) => {
    await seedErpWorkspace(project, "opendomain");
    await cp(
      path.join(project, "opendomain"),
      path.join(project, "domain"),
      { recursive: true }
    );

    const validation = await runJson(["validate", "--json"], project);
    assert.equal(validation.exitCode, 0);
    assertDualRootWarning(validation.payload.warnings);
    assert.ok(validation.payload.documents.every((item) => !item.file.startsWith("domain/")));

    const grounding = await runJson(["prepare", "feature.md", "--json"], project);
    assert.equal(grounding.exitCode, 0);
    assertDualRootWarning(grounding.payload.warnings);
    assert.ok(grounding.payload.read_first.every((item) => item.file.startsWith("opendomain/")));

    const candidates = await runJson(["candidate", "list", "--json"], project);
    assert.equal(candidates.exitCode, 0);
    assertDualRootWarning(candidates.payload.warnings);
    assert.ok(candidates.payload.candidates.every((item) => item.file.startsWith("opendomain/")));

    const ids = await runJson(["ids", "list", "--json"], project);
    assert.equal(ids.exitCode, 0);
    assertDualRootWarning(ids.payload.warnings);
    assert.ok(ids.payload.ids.every((item) => item.file.startsWith("opendomain/")));

    const index = await runJson(["index", "build", "--json"], project);
    assert.equal(index.exitCode, 0);
    assert.equal(index.payload.file, "opendomain/generated/index.json");
    assertDualRootWarning(index.payload.warnings);
    assert.ok(index.payload.index.entries.every((item) => item.source_file.startsWith("opendomain/")));
  });
});

async function seedErpWorkspace(project, workspaceDirectory) {
  await cp(
    path.join(REPOSITORY_ROOT, "examples/erp/opendomain"),
    path.join(project, workspaceDirectory),
    { recursive: true }
  );
  await cp(
    path.join(REPOSITORY_ROOT, "examples/erp/openspec/changes/order-cancellation/spec.md"),
    path.join(project, "feature.md")
  );
}

async function runJson(args, cwd) {
  const stdout = memoryStream();
  const stderr = memoryStream();
  const exitCode = await runCli(args, { stdout, stderr, cwd });
  return {
    exitCode,
    payload: JSON.parse(stdout.toString()),
    stderr: stderr.toString()
  };
}

function assertLegacyWarning(warnings) {
  assert.ok(warnings.some((warning) => warning.problem.includes("legacy")));
}

function assertDualRootWarning(warnings) {
  assert.ok(warnings.some((warning) => warning.problem.includes("ignoring 'domain/'")));
}

async function withTempProject(callback) {
  const project = await mkdtemp(path.join(os.tmpdir(), "opendomain-consumers-"));
  try {
    await callback(project);
  } finally {
    await rm(project, { recursive: true, force: true });
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
