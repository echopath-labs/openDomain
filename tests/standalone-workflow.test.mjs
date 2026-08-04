import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import YAML from "yaml";

test("standalone workflow builds the declared matrix and isolates release permissions", async () => {
  const source = await readFile(
    new URL("../.github/workflows/standalone.yml", import.meta.url),
    "utf8"
  );
  const workflow = YAML.parse(source);

  assert.deepEqual(workflow.permissions, { contents: "read" });
  assert.ok(workflow.on.pull_request);
  assert.deepEqual(workflow.on.release.types, ["published"]);
  assert.ok(workflow.on.workflow_dispatch !== undefined);
  assert.deepEqual(workflow.jobs.build.strategy.matrix.include, [
    { target: "darwin-arm64", runner: "macos-15" },
    { target: "darwin-x64", runner: "macos-15-intel" },
    { target: "linux-x64", runner: "ubuntu-24.04" },
    { target: "windows-x64", runner: "windows-2025" }
  ]);
  assert.equal(workflow.jobs.build.permissions.contents, "read");
  assert.equal(workflow.jobs.aggregate.permissions.contents, "read");
  assert.equal(workflow.jobs.publish.permissions.contents, "write");
  assert.match(workflow.jobs.publish.if, /release/);

  const serializedBuild = JSON.stringify(workflow.jobs.build.steps);
  assert.match(serializedBuild, /24\.18\.0/);
  assert.match(serializedBuild, /build-standalone\.mjs/);
  assert.match(serializedBuild, /smoke-standalone\.mjs/);

  const serializedAggregate = JSON.stringify(workflow.jobs.aggregate.steps);
  assert.match(serializedAggregate, /write-standalone-checksums\.mjs/);
  assert.match(serializedAggregate, /assemble-standalone-assets\.mjs/);
  assert.doesNotMatch(serializedAggregate, /merge-multiple/);
  const serializedPublish = JSON.stringify(workflow.jobs.publish.steps);
  assert.match(serializedPublish, /gh release upload/);
  assert.match(serializedPublish, /SHA256SUMS\.txt/);
  assert.match(serializedPublish, /--repo/);
  assert.match(serializedPublish, /GITHUB_REPOSITORY/);
  assert.doesNotMatch(serializedPublish, /--clobber/);
});
