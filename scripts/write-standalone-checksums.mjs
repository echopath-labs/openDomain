#!/usr/bin/env node

import { writeFile } from "node:fs/promises";
import path from "node:path";
import {
  assertReleaseTagVersion,
  createStandaloneChecksumManifest
} from "./lib/standalone-release.mjs";
import { getPackageVersion } from "../src/packaged-resources.mjs";

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const version = getPackageVersion();
  if (options.releaseTag) {
    assertReleaseTagVersion(options.releaseTag, version);
  }
  const directory = path.resolve(options.directory);
  const manifest = await createStandaloneChecksumManifest(directory, version);
  const manifestPath = path.join(directory, "SHA256SUMS.txt");
  await writeFile(manifestPath, manifest, "utf8");
  process.stdout.write(`${manifestPath}\n`);
}

function parseArguments(arguments_) {
  const options = { directory: "dist/standalone" };
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--dir") {
      options.directory = requiredValue(arguments_, ++index, argument);
    } else if (argument === "--tag") {
      options.releaseTag = requiredValue(arguments_, ++index, argument);
    } else {
      throw new Error(`Unknown checksum option '${argument}'.`);
    }
  }
  return options;
}

function requiredValue(arguments_, index, option) {
  const value = arguments_[index];
  if (!value || value.startsWith("--")) {
    throw new Error(`Checksum option '${option}' requires a value.`);
  }
  return value;
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
