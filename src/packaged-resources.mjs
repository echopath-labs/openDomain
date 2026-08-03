import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SEA_BUILD_ENABLED = typeof __OPENDOMAIN_SEA__ !== "undefined"
  && __OPENDOMAIN_SEA__ === true;

let packageMetadata;

export function readPackagedText(relativePath) {
  const normalized = normalizePackagedPath(relativePath);
  const sea = seaRuntime();

  if (sea) {
    try {
      return sea.getAsset(normalized, "utf8");
    } catch (error) {
      throw new Error(`Packaged resource '${normalized}' could not be read: ${error.message}`, {
        cause: error
      });
    }
  }

  try {
    return readFileSync(new URL(normalized, packageRootUrl()), "utf8");
  } catch (error) {
    throw new Error(`Packaged resource '${normalized}' could not be read: ${error.message}`, {
      cause: error
    });
  }
}

export function listPackagedFiles(relativePrefix) {
  const prefix = normalizePackagedPath(relativePrefix, { prefix: true });
  const sea = seaRuntime();

  if (sea) {
    return sea.getAssetKeys()
      .filter((key) => key.startsWith(prefix) && !key.endsWith("/"))
      .sort();
  }

  const root = fileURLToPath(new URL(prefix, packageRootUrl()));
  try {
    return listFiles(root)
      .map((file) => `${prefix}${file}`)
      .sort();
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw new Error(`Packaged resource prefix '${prefix}' could not be listed: ${error.message}`, {
      cause: error
    });
  }
}

export function getPackageVersion() {
  if (!packageMetadata) {
    packageMetadata = JSON.parse(readPackagedText("package.json"));
  }
  return packageMetadata.version;
}

function seaRuntime() {
  if (!SEA_BUILD_ENABLED) {
    return null;
  }

  const sea = require("node:sea");
  return sea.isSea() ? sea : null;
}

function packageRootUrl() {
  return new URL("../", import.meta.url);
}

function normalizePackagedPath(value, options = {}) {
  if (
    typeof value !== "string"
    || value.length === 0
    || value.includes("\\")
    || path.posix.isAbsolute(value)
  ) {
    throw unsafePathError(value);
  }

  const prefix = options.prefix === true;
  const normalized = prefix && !value.endsWith("/") ? `${value}/` : value;
  const segments = normalized.split("/");
  const pathSegments = prefix ? segments.slice(0, -1) : segments;
  if (
    pathSegments.length === 0
    || pathSegments.some((segment) => segment === "" || segment === "." || segment === "..")
    || pathSegments.some((segment) => !/^[A-Za-z0-9._-]+$/.test(segment))
    || (!prefix && normalized.endsWith("/"))
  ) {
    throw unsafePathError(value);
  }
  return normalized;
}

function listFiles(root, relativeDirectory = "") {
  const directory = path.join(root, relativeDirectory);
  const entries = readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name));
  const files = [];

  for (const entry of entries) {
    const relative = relativeDirectory
      ? path.posix.join(relativeDirectory.split(path.sep).join("/"), entry.name)
      : entry.name;
    if (entry.isDirectory()) {
      files.push(...listFiles(root, relative.split("/").join(path.sep)));
    } else if (entry.isFile()) {
      files.push(relative);
    }
  }
  return files;
}

function unsafePathError(value) {
  return new Error(`Packaged resource path '${String(value)}' must be a safe package-relative path.`);
}
