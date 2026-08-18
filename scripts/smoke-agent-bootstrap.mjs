import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import {
  access,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFile = promisify(execFileCallback);
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const expectedVersion = JSON.parse(await readFile(path.join(packageRoot, "package.json"), "utf8")).version;
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "opendomain-agent-bootstrap-"));
const npmEnvironment = {
  ...process.env,
  npm_config_cache: path.join(temporaryRoot, "npm-cache")
};

try {
  const packResult = await run("npm", [
    "pack",
    "--json",
    "--ignore-scripts",
    "--pack-destination",
    temporaryRoot
  ], packageRoot, npmEnvironment);
  const [packed] = JSON.parse(packResult.stdout);
  const tarball = path.join(temporaryRoot, packed.filename);
  const prefix = path.join(temporaryRoot, "tool-prefix");
  const workspace = path.join(temporaryRoot, "workspace");

  assert.ok(
    packed.files.some((entry) => entry.path === "INSTALL.md"),
    "The npm artifact must include INSTALL.md."
  );

  await mkdir(prefix, { recursive: true });
  await mkdir(workspace, { recursive: true });
  await run("npm", [
    "install",
    "--global",
    "--prefix",
    prefix,
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    tarball
  ], temporaryRoot, npmEnvironment);

  const cli = installedCliPath(prefix);
  await access(cli);

  const version = await run(cli, ["--version"], workspace);
  assert.equal(version.stdout.trim(), expectedVersion);

  const init = await runJsonCli(cli, [
    "init",
    "--tools",
    "codex",
    "--json"
  ], workspace);
  assert.deepEqual(init.errors, []);

  const doctor = await runJsonCli(cli, ["doctor", "--json"], workspace);
  assert.equal(doctor.status, "healthy");
  assert.deepEqual(doctor.errors, []);

  const validation = await runJsonCli(cli, ["validate", "--json"], workspace);
  assert.deepEqual(validation.errors, []);

  for (const packageMetadata of [
    "package.json",
    "package-lock.json",
    "npm-shrinkwrap.json",
    "pnpm-lock.yaml",
    "yarn.lock"
  ]) {
    await assert.rejects(
      access(path.join(workspace, packageMetadata)),
      (error) => error?.code === "ENOENT",
      `${packageMetadata} must not be created in the host workspace.`
    );
  }

  const agents = await readFile(path.join(workspace, "AGENTS.md"), "utf8");
  assert.match(agents, /opendomain assure <source-unit>/);
  assert.match(agents, /Accepted source|accepted source/i);
  assert.match(agents, /Candidate boundaries/);

  const expectedSkills = new Map([
    ["opendomain-explore", /Explore the project's OpenDomain model/],
    ["opendomain-model", /Domain Candidate first/],
    ["opendomain-review", /explicitly chooses a decision/]
  ]);
  for (const [skill, expectedInstruction] of expectedSkills) {
    const skillFile = path.join(workspace, ".codex", "skills", skill, "SKILL.md");
    const contents = await readFile(skillFile, "utf8");
    assert.match(contents, /generatedBy: opendomain/);
    assert.match(contents, expectedInstruction);
  }

  const workspaceEntries = await readdir(workspace);
  assert.deepEqual(
    workspaceEntries.sort(),
    [".codex", "AGENTS.md", "opendomain"],
    "Agent bootstrap must only create OpenDomain-managed workspace paths."
  );

  process.stdout.write(
    `Agent bootstrap smoke passed: ${version.stdout.trim()}, `
    + `integration ${doctor.status}, validation passed, host package metadata absent.\n`
  );
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}

function installedCliPath(prefix) {
  if (process.platform === "win32") {
    return path.join(prefix, "opendomain.cmd");
  }
  return path.join(prefix, "bin", "opendomain");
}

async function runJsonCli(cli, args, cwd) {
  const result = await run(cli, args, cwd);
  return JSON.parse(result.stdout);
}

async function run(command, args, cwd, environment = process.env) {
  try {
    return await execFile(command, args, {
      cwd,
      encoding: "utf8",
      env: environment,
      maxBuffer: 10 * 1024 * 1024,
      shell: process.platform === "win32"
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
