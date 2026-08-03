#!/usr/bin/env node

import { execFile } from "node:child_process";
import { copyFile, chmod, mkdtemp, mkdir, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { build } from "esbuild";
import {
  assertNativeStandaloneTarget,
  assertStandaloneNodeVersion,
  hostStandaloneTarget,
  standaloneAssetName
} from "./lib/standalone-release.mjs";
import {
  getPackageVersion,
  listPackagedFiles
} from "../src/packaged-resources.mjs";

const execute = promisify(execFile);
const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const SEA_SENTINEL_FUSE = "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2";

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const target = options.target ?? hostStandaloneTarget();
  assertNativeStandaloneTarget(target);
  assertStandaloneNodeVersion();

  const version = getPackageVersion();
  const outputDirectory = path.resolve(repositoryRoot, options.outputDirectory);
  const outputPath = path.join(outputDirectory, standaloneAssetName(version, target));
  const temporaryOutputPath = path.join(
    outputDirectory,
    `.${path.basename(outputPath)}.${process.pid}.tmp${process.platform === "win32" ? ".exe" : ""}`
  );
  const workingDirectory = await mkdtemp(path.join(os.tmpdir(), "opendomain-sea-"));

  try {
    await mkdir(outputDirectory, { recursive: true });
    const bundlePath = path.join(workingDirectory, "opendomain.cjs");
    const blobPath = path.join(workingDirectory, "opendomain.blob");
    const configPath = path.join(workingDirectory, "sea-config.json");

    await build({
      entryPoints: [path.join(repositoryRoot, "bin/opendomain.mjs")],
      outfile: bundlePath,
      bundle: true,
      platform: "node",
      format: "cjs",
      target: "node24",
      define: {
        __OPENDOMAIN_SEA__: "true"
      },
      legalComments: "none",
      logLevel: "warning",
      logOverride: {
        "empty-import-meta": "silent"
      },
      minify: false,
      sourcemap: false
    });

    await writeFile(configPath, `${JSON.stringify({
      main: bundlePath,
      output: blobPath,
      disableExperimentalSEAWarning: true,
      useCodeCache: false,
      useSnapshot: false,
      execArgvExtension: "none",
      assets: packagedAssetMap()
    }, null, 2)}\n`, "utf8");

    await run(process.execPath, ["--experimental-sea-config", configPath]);
    await copyFile(process.execPath, temporaryOutputPath);

    if (process.platform === "darwin") {
      await run("codesign", ["--remove-signature", temporaryOutputPath]);
    }

    const postjectCli = fileURLToPath(new URL(
      "../node_modules/postject/dist/cli.js",
      import.meta.url
    ));
    const postjectArguments = [
      postjectCli,
      temporaryOutputPath,
      "NODE_SEA_BLOB",
      blobPath,
      "--sentinel-fuse",
      SEA_SENTINEL_FUSE
    ];
    if (process.platform === "darwin") {
      postjectArguments.push("--macho-segment-name", "NODE_SEA");
    }
    await run(process.execPath, postjectArguments);

    if (process.platform === "darwin") {
      await run("codesign", ["--sign", "-", "--force", temporaryOutputPath]);
    } else if (process.platform !== "win32") {
      await chmod(temporaryOutputPath, 0o755);
    }

    await rm(outputPath, { force: true });
    await rename(temporaryOutputPath, outputPath);
    process.stdout.write(`${outputPath}\n`);
  } finally {
    await rm(temporaryOutputPath, { force: true });
    await rm(workingDirectory, { recursive: true, force: true });
  }
}

function packagedAssetMap() {
  const resourcePaths = [
    "package.json",
    ...listPackagedFiles("schemas"),
    ...listPackagedFiles("examples/erp")
  ].sort();
  return Object.fromEntries(resourcePaths.map((resourcePath) => [
    resourcePath,
    path.join(repositoryRoot, ...resourcePath.split("/"))
  ]));
}

function parseArguments(arguments_) {
  const options = {
    outputDirectory: "dist/standalone"
  };
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--target") {
      options.target = requiredValue(arguments_, ++index, argument);
    } else if (argument === "--out-dir") {
      options.outputDirectory = requiredValue(arguments_, ++index, argument);
    } else {
      throw new Error(`Unknown standalone build option '${argument}'.`);
    }
  }
  return options;
}

function requiredValue(arguments_, index, option) {
  const value = arguments_[index];
  if (!value || value.startsWith("--")) {
    throw new Error(`Standalone build option '${option}' requires a value.`);
  }
  return value;
}

async function run(command, arguments_) {
  try {
    return await execute(command, arguments_, {
      cwd: repositoryRoot,
      maxBuffer: 10 * 1024 * 1024
    });
  } catch (error) {
    const detail = error.stderr || error.stdout || error.message;
    throw new Error(`Command '${command}' failed: ${String(detail).trim()}`, { cause: error });
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
