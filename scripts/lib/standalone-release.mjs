import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, realpath } from "node:fs/promises";
import path from "node:path";

export const STANDALONE_NODE_VERSION = "24.18.0";

export const STANDALONE_TARGETS = Object.freeze([
  "darwin-arm64",
  "darwin-x64",
  "linux-x64",
  "windows-x64"
]);

const HOST_TARGETS = Object.freeze({
  "darwin:arm64": "darwin-arm64",
  "darwin:x64": "darwin-x64",
  "linux:x64": "linux-x64",
  "win32:x64": "windows-x64"
});

export function hostStandaloneTarget(platform = process.platform, architecture = process.arch) {
  const target = HOST_TARGETS[`${platform}:${architecture}`];
  if (!target) {
    throw new Error(`Unsupported standalone host '${platform}-${architecture}'.`);
  }
  return target;
}

export function assertNativeStandaloneTarget(
  requestedTarget,
  platform = process.platform,
  architecture = process.arch
) {
  const nativeTarget = hostStandaloneTarget(platform, architecture);
  if (requestedTarget !== nativeTarget) {
    throw new Error(
      `Requested standalone target '${requestedTarget}' does not match native host '${nativeTarget}'.`
    );
  }
  return nativeTarget;
}

export function assertStandaloneNodeVersion(version = process.versions.node) {
  if (version !== STANDALONE_NODE_VERSION) {
    throw new Error(
      `Standalone builds require Node ${STANDALONE_NODE_VERSION}; current runtime is ${version}.`
    );
  }
  return version;
}

export function standalonePathsOverlap(left, right, platform = process.platform) {
  const implementation = platform === "win32" ? path.win32 : path.posix;
  const normalize = (value) => {
    const normalized = implementation.resolve(value);
    return platform === "win32" ? normalized.toLowerCase() : normalized;
  };
  const normalizedLeft = normalize(left);
  const normalizedRight = normalize(right);
  return isSameOrDescendant(normalizedLeft, normalizedRight, implementation)
    || isSameOrDescendant(normalizedRight, normalizedLeft, implementation);
}

export function standaloneAssetName(version, target) {
  assertVersion(version);
  if (!STANDALONE_TARGETS.includes(target)) {
    throw new Error(`Unsupported standalone target '${target}'.`);
  }
  const extension = target.startsWith("windows-") ? ".exe" : "";
  return `opendomain-v${version}-${target}${extension}`;
}

export function assertReleaseTagVersion(tag, version) {
  assertVersion(version);
  if (typeof tag !== "string" || !tag.startsWith("v")) {
    throw new Error(`Release tag '${String(tag)}' must use the form 'v<package-version>'.`);
  }
  if (tag !== `v${version}`) {
    throw new Error(`Release tag '${tag}' does not match package version '${version}'.`);
  }
  return version;
}

export async function assembleStandaloneReleaseAssets(artifactRoot, outputDirectory, version) {
  assertVersion(version);
  const root = await realpath(path.resolve(artifactRoot));
  const requestedOutput = path.resolve(outputDirectory);
  const outputParent = await realpath(path.dirname(requestedOutput));
  const output = path.join(outputParent, path.basename(requestedOutput));
  if (standalonePathsOverlap(root, output)) {
    throw new Error("Standalone release output and native artifact root must not overlap.");
  }

  const expectedDirectories = STANDALONE_TARGETS
    .map((target) => `standalone-${target}`)
    .sort();
  const rootEntries = await readdir(root, { withFileTypes: true });
  const actualDirectories = rootEntries.map((entry) => entry.name).sort();
  if (
    actualDirectories.length !== expectedDirectories.length
    || actualDirectories.some((name, index) => name !== expectedDirectories[index])
    || rootEntries.some((entry) => !entry.isDirectory())
  ) {
    throw new Error(
      `Native artifact directories must be exactly: ${expectedDirectories.join(", ")}.`
    );
  }

  const sources = [];
  for (const target of STANDALONE_TARGETS) {
    const artifactDirectory = path.join(root, `standalone-${target}`);
    const expectedAsset = standaloneAssetName(version, target);
    const entries = await readdir(artifactDirectory, { withFileTypes: true });
    if (
      entries.length !== 1
      || entries[0].name !== expectedAsset
      || !entries[0].isFile()
    ) {
      const names = entries.map((entry) => entry.name).sort();
      throw new Error(
        `Found unexpected files in native artifact 'standalone-${target}': ${names.join(", ") || "<none>"}.`
      );
    }
    sources.push({ source: path.join(artifactDirectory, expectedAsset), name: expectedAsset });
  }

  try {
    await mkdir(output);
  } catch (error) {
    if (error.code === "EEXIST") {
      throw new Error(`Standalone release output '${output}' must not already exist.`, {
        cause: error
      });
    }
    throw error;
  }
  for (const item of sources) {
    await copyFile(item.source, path.join(output, item.name));
  }
  return sources.map((item) => item.name).sort();
}

function isSameOrDescendant(parent, candidate, implementation) {
  const relative = implementation.relative(parent, candidate);
  return relative === ""
    || (
      relative !== ".."
      && !relative.startsWith(`..${implementation.sep}`)
      && !implementation.isAbsolute(relative)
    );
}

export async function createStandaloneChecksumManifest(directory, version) {
  const expected = STANDALONE_TARGETS
    .map((target) => standaloneAssetName(version, target))
    .sort();
  const entries = await readdir(directory, { withFileTypes: true });
  const actual = entries
    .filter((entry) => entry.isFile() && entry.name !== "SHA256SUMS.txt")
    .map((entry) => entry.name)
    .sort();
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  const unexpected = actual.filter((name) => !expectedSet.has(name));
  const missing = expected.filter((name) => !actualSet.has(name));

  if (unexpected.length > 0) {
    throw new Error(`Found unexpected standalone release assets: ${unexpected.join(", ")}.`);
  }
  if (missing.length > 0) {
    throw new Error(`Found missing standalone release assets: ${missing.join(", ")}.`);
  }
  const lines = [];
  for (const name of expected) {
    const content = await readFile(path.join(directory, name));
    const hash = createHash("sha256").update(content).digest("hex");
    lines.push(`${hash}  ${name}`);
  }
  return `${lines.join("\n")}\n`;
}

function assertVersion(version) {
  if (typeof version !== "string" || !/^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`Invalid standalone release version '${String(version)}'.`);
  }
}
