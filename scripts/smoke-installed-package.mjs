import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import {
  access,
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFile = promisify(execFileCallback);
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "opendomain-package-smoke-"));
const offline = parseArguments(process.argv.slice(2));
const npmEnvironment = offline
  ? { ...process.env, npm_config_offline: "true" }
  : { ...process.env, npm_config_cache: path.join(temporaryRoot, "npm-cache") };

try {
  const packResult = await run("npm", [
    "pack",
    "--json",
    "--ignore-scripts",
    "--pack-destination",
    temporaryRoot
  ], packageRoot, npmEnvironment);
  const packPayload = JSON.parse(packResult.stdout);
  const tarball = path.join(temporaryRoot, packPayload[0].filename);
  const consumer = path.join(temporaryRoot, "consumer");

  await mkdir(consumer, { recursive: true });
  await writeFile(path.join(consumer, "package.json"), `${JSON.stringify({
    name: "opendomain-installed-package-smoke",
    private: true,
    version: "1.0.0"
  }, null, 2)}\n`, "utf8");
  await run("npm", [
    "install",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    ...(offline ? ["--offline"] : []),
    tarball
  ], consumer, npmEnvironment);

  const installedRoot = path.join(
    consumer,
    "node_modules",
    "@echopath-labs",
    "opendomain"
  );
  const cli = path.join(installedRoot, "bin", "opendomain.mjs");
  const hostPackageFile = path.join(consumer, "package.json");
  const hostLockFile = path.join(consumer, "package-lock.json");
  const hostPackageBefore = await readFile(hostPackageFile, "utf8");
  const hostLockBefore = await readFile(hostLockFile, "utf8");
  await access(path.join(installedRoot, "schemas", "integration-profile.schema.json"));
  await access(path.join(installedRoot, "schemas", "domain-declaration.schema.json"));
  await access(path.join(installedRoot, "schemas", "assurance-result.schema.json"));
  await access(path.join(installedRoot, "schemas", "workspace-config.schema.json"));
  await access(path.join(installedRoot, "schemas", "governance.schema.json"));
  await access(path.join(installedRoot, "schemas", "context-export.schema.json"));
  for (const publicDocument of [
    "README.md",
    "README.zh-CN.md",
    "USAGE.md",
    "USAGE.zh-CN.md",
    "INSTALL.md",
    "CONTRIBUTING.md",
    "SECURITY.md",
    "CHANGELOG.md",
    "LICENSE",
    "NOTICE",
    "examples/erp/README.md"
  ]) {
    await access(path.join(installedRoot, ...publicDocument.split("/")));
  }
  for (const privatePath of ["openspec", "docs", ".codex"]) {
    await assert.rejects(
      access(path.join(installedRoot, privatePath)),
      (error) => error?.code === "ENOENT"
    );
  }
  await access(path.join(installedRoot, "scripts", "smoke-installed-package.mjs"));
  for (const maintainerScript of [
    "assemble-standalone-assets.mjs",
    "build-standalone.mjs",
    "lib/standalone-release.mjs",
    "smoke-agent-bootstrap.mjs",
    "smoke-standalone.mjs",
    "write-standalone-checksums.mjs"
  ]) {
    await assert.rejects(
      access(path.join(installedRoot, "scripts", ...maintainerScript.split("/"))),
      (error) => error?.code === "ENOENT"
    );
  }

  const init = await runJsonCli(cli, [
    "init",
    "--tools",
    "codex",
    "--example",
    "erp",
    "--json"
  ], consumer);
  assert.deepEqual(init.errors, []);
  assert.equal(await readFile(hostPackageFile, "utf8"), hostPackageBefore);
  assert.equal(await readFile(hostLockFile, "utf8"), hostLockBefore);
  await access(path.join(consumer, ".codex", "skills", "opendomain-explore", "SKILL.md"));
  const doctor = await runJsonCli(cli, ["doctor", "--json"], consumer);
  assert.equal(doctor.status, "healthy");
  assert.deepEqual(doctor.errors, []);

  const governedRoot = path.join(consumer, "governed");
  await createGovernedWorkspace(governedRoot);
  const coreSmokeFile = path.join(consumer, "core-smoke.mjs");
  await writeFile(coreSmokeFile, `
import assert from "node:assert/strict";
import * as root from "@echopath-labs/opendomain";
import * as core from "@echopath-labs/opendomain/core";

const now = new Date("2026-08-10T00:00:00Z");
assert.equal(root.CORE_API_VERSION, "1.0");
assert.equal(core.exportContext, root.exportContext);
const query = await root.queryWorkspace({ target: "examples/erp", cwd: process.cwd(), selector: { id: "sales.order" }, now });
const context = await core.exportContext({ target: "examples/erp", cwd: process.cwd(), selector: { id: "sales.order" }, now });
const publication = await core.exportContext({
  cwd: ${JSON.stringify(governedRoot)},
  selector: { product: "alpha" },
  exposure: "public",
  now
});
assert.equal(query.status, "pass");
assert.equal(context.status, "pass");
assert.equal(publication.status, "pass");
assert.deepEqual(publication.documents.map((item) => item.id), ["alpha"]);
process.stdout.write(JSON.stringify({
  api: root.CORE_API_VERSION,
  query: query.accepted_ids.length,
  context: context.documents.length,
  candidates: context.candidate_boundaries.length,
  public_documents: publication.documents.length
}));
`, "utf8");
  const coreSmoke = JSON.parse((await run(process.execPath, [coreSmokeFile], consumer)).stdout);
  assert.equal(coreSmoke.api, "1.0");
  assert.ok(coreSmoke.query > 0);
  assert.equal(coreSmoke.context, coreSmoke.query);
  assert.ok(coreSmoke.candidates > 0);
  assert.equal(coreSmoke.public_documents, 1);
  await assert.rejects(
    access(path.join(consumer, "opendomain", "generated", "index.json")),
    (error) => error?.code === "ENOENT"
  );

  const exampleRoot = path.join(consumer, "examples", "erp");
  const inspection = await runJsonCli(
    cli,
    ["integrations", "validate", "--json"],
    exampleRoot
  );
  assert.deepEqual(inspection.errors, []);
  assert.equal(inspection.valid_profile_count, 1);

  const explicit = await runJsonCli(cli, [
    "prepare",
    "--profile",
    "structured-feature",
    "external-features/order-cancellation.yaml",
    "--json"
  ], exampleRoot);
  assert.deepEqual(explicit.errors, []);
  assert.equal(explicit.grounding_request.integration.id, "structured-feature");
  assert.equal(explicit.grounding_request.integration.selected, "explicit");
  assert.ok(explicit.read_first.some((item) => item.id === "sales.order"));

  const automatic = await runJsonCli(cli, [
    "prepare",
    "external-features/order-cancellation.yaml",
    "--json"
  ], exampleRoot);
  assert.deepEqual(automatic.errors, []);
  assert.equal(automatic.grounding_request.integration.id, "structured-feature");
  assert.equal(automatic.grounding_request.integration.selected, "auto");
  assert.deepEqual(automatic.read_first, explicit.read_first);

  const assurance = await runJsonCli(cli, [
    "assure",
    "openspec/changes/order-cancellation/spec.md",
    "--json"
  ], exampleRoot);
  assert.equal(assurance.grounding_pack.grounding_request.grounding.status, "required");
  assert.equal(assurance.preparation.state, "prepared");
  assert.notEqual(assurance.policy.outcome, "fail");
  assert.ok(assurance.grounding_pack.read_first.some((item) => item.id === "sales.order"));

  process.stdout.write(
    `Installed-package smoke passed: ${packPayload[0].filename}, `
    + `${inspection.valid_profile_count} Profile, `
    + `${automatic.read_first.length} grounded sources, `
    + `Core ${coreSmoke.api} with ${coreSmoke.context} exported sources, `
    + `Agent integration ${doctor.status}, `
    + `Assurance ${assurance.policy.outcome}.\n`
  );
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
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
    location: smoke:installed-package
    summary: Synthetic public context for installed-package Core smoke.
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

async function runJsonCli(cli, args, cwd) {
  const result = await run(process.execPath, [cli, ...args], cwd);
  return JSON.parse(result.stdout);
}

async function run(command, args, cwd, environment = process.env) {
  try {
    return await execFile(command, args, {
      cwd,
      encoding: "utf8",
      env: environment,
      maxBuffer: 10 * 1024 * 1024
    });
  } catch (error) {
    const stdout = error.stdout ? `\nstdout:\n${error.stdout}` : "";
    const stderr = error.stderr ? `\nstderr:\n${error.stderr}` : "";
    throw new Error(
      `Command failed: ${command} ${args.join(" ")}${stdout}${stderr}`,
      { cause: error }
    );
  }
}

function parseArguments(arguments_) {
  if (arguments_.length === 0) return false;
  if (arguments_.length === 1 && arguments_[0] === "--offline") return true;
  throw new Error("Usage: smoke-installed-package [--offline]");
}
