#!/usr/bin/env node

import {
  assembleStandaloneReleaseAssets,
  assertReleaseTagVersion
} from "./lib/standalone-release.mjs";
import { getPackageVersion } from "../src/packaged-resources.mjs";

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const version = getPackageVersion();
  if (options.releaseTag) {
    assertReleaseTagVersion(options.releaseTag, version);
  }
  const assets = await assembleStandaloneReleaseAssets(
    options.artifactRoot,
    options.outputDirectory,
    version
  );
  process.stdout.write(`${assets.join("\n")}\n`);
}

function parseArguments(arguments_) {
  const options = {
    artifactRoot: "dist/native-artifacts",
    outputDirectory: "dist/standalone"
  };
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--artifacts-dir") {
      options.artifactRoot = requiredValue(arguments_, ++index, argument);
    } else if (argument === "--out-dir") {
      options.outputDirectory = requiredValue(arguments_, ++index, argument);
    } else if (argument === "--tag") {
      options.releaseTag = requiredValue(arguments_, ++index, argument);
    } else {
      throw new Error(`Unknown standalone assembly option '${argument}'.`);
    }
  }
  return options;
}

function requiredValue(arguments_, index, option) {
  const value = arguments_[index];
  if (!value || value.startsWith("--")) {
    throw new Error(`Standalone assembly option '${option}' requires a value.`);
  }
  return value;
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
