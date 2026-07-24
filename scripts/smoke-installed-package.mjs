import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import {
  access,
  mkdtemp,
  mkdir,
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

try {
  const packResult = await run("npm", [
    "pack",
    "--json",
    "--ignore-scripts",
    "--pack-destination",
    temporaryRoot
  ], packageRoot);
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
    tarball
  ], consumer);

  const installedRoot = path.join(
    consumer,
    "node_modules",
    "@echopath-labs",
    "opendomain"
  );
  const cli = path.join(installedRoot, "bin", "opendomain.mjs");
  await access(path.join(installedRoot, "schemas", "integration-profile.schema.json"));
  await access(path.join(installedRoot, "schemas", "domain-declaration.schema.json"));
  await access(path.join(installedRoot, "docs", "integration-profiles.md"));
  await access(path.join(installedRoot, "scripts", "smoke-installed-package.mjs"));

  const init = await runJsonCli(cli, ["init", "--example", "erp", "--json"], consumer);
  assert.deepEqual(init.errors, []);

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

  process.stdout.write(
    `Installed-package smoke passed: ${packPayload[0].filename}, `
    + `${inspection.valid_profile_count} Profile, `
    + `${automatic.read_first.length} grounded sources.\n`
  );
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}

async function runJsonCli(cli, args, cwd) {
  const result = await run(process.execPath, [cli, ...args], cwd);
  return JSON.parse(result.stdout);
}

async function run(command, args, cwd) {
  try {
    return await execFile(command, args, {
      cwd,
      encoding: "utf8",
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
