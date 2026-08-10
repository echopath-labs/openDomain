#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import {
  access,
  constants,
  mkdtemp,
  mkdir,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import {
  hostStandaloneTarget,
  standaloneAssetName
} from "./lib/standalone-release.mjs";
import { getPackageVersion } from "../src/packaged-resources.mjs";

const execFile = promisify(execFileCallback);

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const version = getPackageVersion();
  const target = hostStandaloneTarget();
  const binary = options.binary
    ? path.resolve(options.binary)
    : path.resolve(options.directory, standaloneAssetName(version, target));
  assert.equal(path.basename(binary), standaloneAssetName(version, target));
  await access(binary, constants.R_OK);
  if (process.platform !== "win32") {
    assert.notEqual((await stat(binary)).mode & 0o111, 0, "Standalone binary must be executable.");
  }

  const versionResult = await run(binary, ["--version"], process.cwd());
  assert.equal(versionResult.stdout, `${version}\n`);
  assert.equal(versionResult.stderr, "");
  const helpResult = await run(binary, ["--help"], process.cwd());
  assert.match(helpResult.stdout, /opendomain init/);
  assert.equal(helpResult.stderr, "");

  const workspace = await mkdtemp(path.join(os.tmpdir(), "opendomain-standalone-smoke-"));
  try {
    await assertAbsent(path.join(workspace, "package.json"));
    await assertAbsent(path.join(workspace, "package-lock.json"));

    const init = await runJson(binary, [
      "init",
      "--tools",
      "codex",
      "--example",
      "erp",
      "--json"
    ], workspace);
    assert.deepEqual(init.errors, []);
    await access(path.join(workspace, "opendomain", "README.md"));
    await access(path.join(workspace, ".codex", "skills", "opendomain-explore", "SKILL.md"));

    const doctor = await runJson(binary, ["doctor", "--json"], workspace);
    assert.equal(doctor.status, "healthy");
    assert.deepEqual(doctor.errors, []);

    const workspaceValidation = await runJson(binary, ["validate", "--json"], workspace);
    assert.deepEqual(workspaceValidation.errors, []);

    const sourceQuery = await runJson(binary, [
      "query",
      "examples/erp",
      "--id",
      "sales.order",
      "--json"
    ], workspace);
    assert.deepEqual(sourceQuery.errors, []);
    assert.ok(sourceQuery.accepted_ids.includes("sales.order"));
    const contextExport = await runJson(binary, [
      "export",
      "context",
      "examples/erp",
      "--id",
      "sales.order",
      "--json"
    ], workspace);
    assert.deepEqual(contextExport.errors, []);
    assert.equal(contextExport.schema, "opendomain.context-export.v1");
    assert.ok(contextExport.documents.some((item) => item.id === "sales.order"));
    assert.ok(contextExport.candidate_boundaries.length > 0);
    await assertAbsent(path.join(workspace, "opendomain", "generated", "index.json"));

    const governedRoot = path.join(workspace, "governed");
    await createGovernedWorkspace(governedRoot);
    const publicExport = await runJson(binary, [
      "export",
      "context",
      "--product",
      "alpha",
      "--exposure",
      "public",
      "--json"
    ], governedRoot);
    assert.deepEqual(publicExport.errors, []);
    assert.deepEqual(publicExport.documents.map((item) => item.id), ["alpha"]);
    assert.equal(publicExport.governance.publication_closure.product_id, "alpha");

    const exampleRoot = path.join(workspace, "examples", "erp");
    const exampleValidation = await runJson(binary, ["validate", "--json"], exampleRoot);
    assert.deepEqual(exampleValidation.errors, []);

    const sourceUnit = "openspec/changes/order-cancellation/spec.md";
    const groundingPack = await runJson(binary, ["prepare", sourceUnit, "--json"], exampleRoot);
    assert.deepEqual(groundingPack.errors, []);
    assert.ok(groundingPack.read_first.some((item) => item.id === "sales.order"));
    assert.ok(groundingPack.candidate_boundaries.length > 0);

    const assurance = await runJson(binary, ["assure", sourceUnit, "--json"], exampleRoot);
    assert.equal(assurance.grounding_pack.grounding_request.grounding.status, "required");
    assert.equal(assurance.preparation.state, "prepared");
    assert.notEqual(assurance.policy.outcome, "fail");
    assert.ok(assurance.grounding_pack.read_first.some((item) => item.id === "sales.order"));

    await assertAbsent(path.join(workspace, "package.json"));
    await assertAbsent(path.join(workspace, "package-lock.json"));

    process.stdout.write(
      `Standalone smoke passed: ${path.basename(binary)}, `
      + `${groundingPack.read_first.length} grounded sources, `
      + `${contextExport.documents.length} Core-equivalent exported sources, `
      + `Agent integration ${doctor.status}, `
      + `Assurance ${assurance.policy.outcome}.\n`
    );
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

async function createGovernedWorkspace(root) {
  const sourceRoot = path.join(root, "opendomain", "products", "alpha", "public", "contexts");
  await mkdir(sourceRoot, { recursive: true });
  await writeFile(path.join(root, "opendomain", "governance.yaml"), `schema_version: "1.0"
products:
  - id: alpha
    owners: [alpha-owner]
    exposure: public
    dependencies: []
    forbidden_dependencies: []
domain_groups:
  - id: alpha.public
    product: alpha
    source_root: products/alpha/public
    owners: [alpha-owner]
    exposure: public
    dependencies: []
    forbidden_dependencies: []
`, "utf8");
  await writeFile(path.join(sourceRoot, "alpha.md"), `---
type: bounded_context
id: alpha
name: Alpha
status: accepted
owners: [alpha-owner]
evidence:
  - type: human_review
    location: smoke:standalone
    summary: Synthetic public context for standalone context-export smoke.
    confidence: high
review:
  state: accepted
  reviewed_by: smoke-maintainer
  reviewed_at: 2026-08-10
---

# Alpha

Synthetic public Alpha context.
`, "utf8");
}

function parseArguments(arguments_) {
  if (arguments_.length !== 2 || !arguments_[1]) {
    throw new Error("Usage: smoke-standalone (--binary <path> | --dir <directory>)");
  }
  if (arguments_[0] === "--binary") {
    return { binary: arguments_[1] };
  }
  if (arguments_[0] === "--dir") {
    return { directory: arguments_[1] };
  }
  throw new Error("Usage: smoke-standalone (--binary <path> | --dir <directory>)");
}

async function assertAbsent(file) {
  await assert.rejects(access(file), (error) => error?.code === "ENOENT");
}

async function runJson(binary, arguments_, cwd) {
  const result = await run(binary, arguments_, cwd);
  return JSON.parse(result.stdout);
}

async function run(command, arguments_, cwd) {
  try {
    return await execFile(command, arguments_, {
      cwd,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024
    });
  } catch (error) {
    const stdout = error.stdout ? `\nstdout:\n${error.stdout}` : "";
    const stderr = error.stderr ? `\nstderr:\n${error.stderr}` : "";
    throw new Error(
      `Command failed: ${command} ${arguments_.join(" ")}${stdout}${stderr}`,
      { cause: error }
    );
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
