import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  realpath,
  rm,
  symlink,
  writeFile
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  CANONICAL_DEFAULT_INDEX_PATH,
  LEGACY_DEFAULT_INDEX_PATH,
  resolveWorkspaceSources
} from "../src/workspace-resolver.mjs";

test("canonical workspace is selected without scanning repository examples", async () => {
  await withTempProject(async (project) => {
    await writeMarkdown(project, "opendomain/contexts/canonical.md");
    await writeMarkdown(project, "examples/demo/opendomain/contexts/example.md");
    await writeMarkdown(project, "opendomain/generated/derived.md");
    await writeMarkdown(project, "opendomain/integrations/profiles/profile.md");

    const result = await resolveWorkspaceSources(undefined, { cwd: project });

    assert.equal(result.mode, "canonical");
    assert.equal(result.defaultIndexPath, CANONICAL_DEFAULT_INDEX_PATH);
    assert.equal(result.errors.length, 0);
    assert.equal(result.warnings.length, 0);
    assert.deepEqual(relativeFiles(project, result.files), [
      "opendomain/contexts/canonical.md"
    ]);
  });
});

test("legacy workspace remains readable with an actionable warning", async () => {
  await withTempProject(async (project) => {
    await writeMarkdown(project, "domain/contexts/legacy.md");

    const result = await resolveWorkspaceSources(undefined, { cwd: project });

    assert.equal(result.mode, "legacy");
    assert.equal(result.defaultIndexPath, LEGACY_DEFAULT_INDEX_PATH);
    assert.equal(result.errors.length, 0);
    assert.ok(result.warnings.some((warning) => warning.problem.includes("legacy")));
    assert.deepEqual(relativeFiles(project, result.files), [
      "domain/contexts/legacy.md"
    ]);
  });
});

test("canonical workspace wins without merging a coexisting legacy root", async () => {
  await withTempProject(async (project) => {
    await writeMarkdown(project, "opendomain/contexts/canonical.md");
    await writeMarkdown(project, "domain/contexts/legacy.md");

    const result = await resolveWorkspaceSources(undefined, { cwd: project });

    assert.equal(result.mode, "canonical");
    assert.equal(result.errors.length, 0);
    assert.ok(result.warnings.some((warning) => warning.problem.includes("ignoring 'domain/'")));
    assert.deepEqual(relativeFiles(project, result.files), [
      "opendomain/contexts/canonical.md"
    ]);
  });
});

test("missing and empty implicit workspaces fail instead of validating zero documents", async () => {
  await withTempProject(async (project) => {
    const missing = await resolveWorkspaceSources(undefined, { cwd: project });
    assert.ok(missing.errors.some((error) => error.problem.includes("No OpenDomain workspace")));

    await mkdir(path.join(project, "opendomain/contexts"), { recursive: true });
    await writeFile(path.join(project, "opendomain/README.md"), "# README\n", "utf8");
    const empty = await resolveWorkspaceSources(undefined, { cwd: project });
    assert.ok(empty.errors.some((error) => error.problem.includes("no eligible Markdown")));
  });
});

test("invalid implicit workspace roots and semantic source slots fail safely", async () => {
  await withTempProject(async (project) => {
    await writeFile(path.join(project, "opendomain"), "not a directory\n", "utf8");
    const invalidRoot = await resolveWorkspaceSources(undefined, { cwd: project });
    assert.ok(invalidRoot.errors.some((error) => error.problem.includes("not a directory")));

    await rm(path.join(project, "opendomain"));
    await mkdir(path.join(project, "opendomain"), { recursive: true });
    await writeFile(path.join(project, "opendomain/contexts"), "not a directory\n", "utf8");
    const invalidSlot = await resolveWorkspaceSources(undefined, { cwd: project });
    assert.ok(invalidSlot.errors.some((error) => error.problem.includes("source slot")));
  });
});

test("explicit targets work without a default workspace and reject unsupported selections", async () => {
  await withTempProject(async (project) => {
    await writeMarkdown(project, "examples/demo/domain/context.md");
    await writeFile(path.join(project, "notes.txt"), "not markdown\n", "utf8");
    await mkdir(path.join(project, "empty"), { recursive: true });

    const directory = await resolveWorkspaceSources("examples/demo", { cwd: project });
    assert.equal(directory.mode, "explicit");
    assert.equal(directory.errors.length, 0);
    assert.deepEqual(relativeFiles(project, directory.files), [
      "examples/demo/domain/context.md"
    ]);

    const file = await resolveWorkspaceSources("examples/demo/domain/context.md", { cwd: project });
    assert.equal(file.errors.length, 0);
    assert.equal(file.files.length, 1);

    const missing = await resolveWorkspaceSources("missing", { cwd: project });
    assert.ok(missing.errors.some((error) => error.problem.includes("does not exist")));

    const unsupported = await resolveWorkspaceSources("notes.txt", { cwd: project });
    assert.ok(unsupported.errors.some((error) => error.problem.includes("not a Markdown")));

    const empty = await resolveWorkspaceSources("empty", { cwd: project });
    assert.ok(empty.errors.some((error) => error.problem.includes("no eligible Markdown")));
  });
});

test("source ordering is deterministic and symlinked descendants are not followed", async () => {
  await withTempProject(async (project) => {
    await writeMarkdown(project, "opendomain/concepts/z.md");
    await writeMarkdown(project, "opendomain/concepts/a.md");
    const external = await mkdtemp(path.join(os.tmpdir(), "opendomain-external-"));
    try {
      await writeMarkdown(external, "escaped.md");
      await symlink(external, path.join(project, "opendomain/concepts/external"));

      const first = await resolveWorkspaceSources(undefined, { cwd: project });
      const second = await resolveWorkspaceSources(undefined, { cwd: project });

      assert.deepEqual(relativeFiles(project, first.files), [
        "opendomain/concepts/a.md",
        "opendomain/concepts/z.md"
      ]);
      assert.deepEqual(first.files, second.files);
    } finally {
      await rm(external, { recursive: true, force: true });
    }
  });
});

test("implicit workspace roots cannot resolve outside the project", async () => {
  await withTempProject(async (project) => {
    const external = await mkdtemp(path.join(os.tmpdir(), "opendomain-root-escape-"));
    try {
      await writeMarkdown(external, "contexts/escaped.md");
      await symlink(external, path.join(project, "opendomain"));

      const implicit = await resolveWorkspaceSources(undefined, { cwd: project });
      assert.equal(implicit.files.length, 0);
      assert.ok(implicit.errors.some((error) => error.problem.includes("outside the project root")));

      const explicit = await resolveWorkspaceSources(external, { cwd: project });
      assert.equal(explicit.errors.length, 0);
      assert.equal(explicit.files.length, 1);
    } finally {
      await rm(external, { recursive: true, force: true });
    }
  });
});

async function withTempProject(callback) {
  const project = await mkdtemp(path.join(os.tmpdir(), "opendomain-workspace-"));
  try {
    await callback(await realpath(project));
  } finally {
    await rm(project, { recursive: true, force: true });
  }
}

async function writeMarkdown(project, relativePath) {
  const file = path.join(project, relativePath);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, "---\ntype: fixture\n---\n", "utf8");
}

function relativeFiles(project, files) {
  return files.map((file) => path.relative(project, file).split(path.sep).join("/"));
}
