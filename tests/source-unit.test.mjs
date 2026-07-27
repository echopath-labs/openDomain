import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  rm,
  symlink,
  writeFile
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  findMatchingProfileSourceUnits,
  publicSourceUnit,
  resolveProfileSourceUnit
} from "../src/source-unit.mjs";

test("file Source Unit uses one canonical primary member", async () => {
  await withProject(async (project) => {
    await write(project, "features/add-x.yaml", "id: feature.add-x\n");
    const entry = fileEntry("structured-feature", "features/**/*.yaml");

    const result = await resolveProfileSourceUnit(
      entry,
      "features/add-x.yaml",
      { cwd: project }
    );

    assert.equal(result.matched, true);
    assert.equal(result.errors.length, 0);
    assert.deepEqual(publicSourceUnit(result.sourceUnit), {
      schema_version: "1.0",
      kind: "file",
      input_path: "features/add-x.yaml",
      root_path: "features/add-x.yaml",
      source_type: "structured-feature",
      profile_id: "structured-feature",
      members: [{
        role: "primary",
        path: "features/add-x.yaml"
      }]
    });
  });
});

test("bundle Source Unit selects nearest root and only exact members", async () => {
  await withProject(async (project) => {
    await write(project, "changes/outer/change.yaml", "id: outer\n");
    await write(project, "changes/outer/feature.md", "---\nid: outer\n---\n");
    await write(project, "changes/outer/nested/change.yaml", "id: nested\n");
    await write(project, "changes/outer/nested/feature.md", "---\nid: nested\n---\n");
    await write(project, "changes/outer/nested/opendomain.yaml", "schema_version: \"1.0\"\n");
    await write(project, "changes/outer/nested/notes.md", "unrelated prose\n");

    const result = await resolveProfileSourceUnit(
      bundleEntry("structured-change"),
      "changes/outer/nested/notes.md",
      { cwd: project }
    );

    assert.equal(result.matched, true);
    assert.equal(result.errors.length, 0);
    assert.equal(result.sourceUnit.root_path, "changes/outer/nested");
    assert.deepEqual(
      result.sourceUnit.members.map((member) => [member.role, member.path]),
      [
        ["primary", "changes/outer/nested/feature.md"],
        ["manifest", "changes/outer/nested/change.yaml"],
        ["declaration", "changes/outer/nested/opendomain.yaml"]
      ]
    );
    assert.equal(result.sourceUnit.members.some((member) => member.path.endsWith("notes.md")), false);
  });
});

test("bundle Source Unit reports missing required members after matching", async () => {
  await withProject(async (project) => {
    await write(project, "changes/incomplete/change.yaml", "id: incomplete\n");

    const result = await resolveProfileSourceUnit(
      bundleEntry("structured-change"),
      "changes/incomplete",
      { cwd: project }
    );

    assert.equal(result.matched, true);
    assert.ok(result.errors.some((error) => (
      error.field === "source_unit.members.primary"
      && error.problem.includes("missing")
    )));
    assert.ok(result.errors.some((error) => (
      error.field === "source_unit.members.declaration"
      && error.problem.includes("missing")
    )));
  });
});

test("Source Unit rejects workspace and bundle symlink escapes", async () => {
  await withProject(async (project) => {
    const external = await mkdtemp(path.join(os.tmpdir(), "opendomain-source-external-"));
    try {
      await write(external, "feature.md", "---\nid: escaped\n---\n");
      await write(project, "changes/escaped/change.yaml", "id: escaped\n");
      await write(project, "changes/escaped/opendomain.yaml", "schema_version: \"1.0\"\n");
      await symlink(
        path.join(external, "feature.md"),
        path.join(project, "changes/escaped/feature.md")
      );

      const memberEscape = await resolveProfileSourceUnit(
        bundleEntry("structured-change"),
        "changes/escaped",
        { cwd: project }
      );
      assert.equal(memberEscape.matched, true);
      assert.ok(memberEscape.errors.some((error) => error.problem.includes("outside the bundle")));

      await symlink(external, path.join(project, "outside-link"));
      const inputEscape = await resolveProfileSourceUnit(
        fileEntry("external", "outside-link/**"),
        "outside-link/feature.md",
        { cwd: project }
      );
      assert.equal(inputEscape.matched, false);
      assert.ok(inputEscape.errors.some((error) => error.problem.includes("outside the project workspace")));
    } finally {
      await rm(external, { recursive: true, force: true });
    }
  });
});

test("automatic matching returns every matching Profile without precedence", async () => {
  await withProject(async (project) => {
    await write(project, "features/add-x.yaml", "id: feature.add-x\n");
    const result = await findMatchingProfileSourceUnits([
      fileEntry("first-profile", "features/**"),
      fileEntry("second-profile", "features/**/*.yaml"),
      fileEntry("unrelated-profile", "tasks/**")
    ], "features/add-x.yaml", { cwd: project });

    assert.equal(result.errors.length, 0);
    assert.deepEqual(
      result.matches.map((match) => match.entry.id),
      ["first-profile", "second-profile"]
    );
  });
});

async function withProject(callback) {
  const project = await mkdtemp(path.join(os.tmpdir(), "opendomain-source-unit-"));
  try {
    await callback(project);
  } finally {
    await rm(project, { recursive: true, force: true });
  }
}

async function write(root, relativePath, content) {
  const file = path.join(root, relativePath);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content, "utf8");
}

function fileEntry(id, pattern) {
  return {
    id,
    sourceFile: `opendomain/integrations/profiles/${id}.yaml`,
    profile: {
      source_type: "structured-feature",
      source_unit: {
        kind: "file",
        match: {
          paths: [pattern]
        }
      }
    }
  };
}

function bundleEntry(id) {
  return {
    id,
    sourceFile: `opendomain/integrations/profiles/${id}.yaml`,
    profile: {
      source_type: "structured-change",
      source_unit: {
        kind: "bundle",
        match: {
          paths: ["changes/**"],
          root_marker: "change.yaml"
        },
        members: {
          primary: {
            path: "feature.md",
            required: true
          },
          manifest: {
            path: "change.yaml",
            required: true
          },
          declaration: {
            path: "opendomain.yaml",
            required: true
          }
        }
      }
    }
  };
}
