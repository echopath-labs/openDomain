import { readFile } from "node:fs/promises";
import {
  isMap,
  isScalar,
  parseDocument,
  stringify,
  visit
} from "yaml";

const KEY_PATTERN = /^[A-Za-z0-9_-]+$/;
const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype", "<<"]);
const YAML_OPTIONS = {
  version: "1.2",
  schema: "core",
  strict: true,
  uniqueKeys: true,
  merge: false,
  resolveKnownTags: false,
  customTags: []
};

export async function parseMarkdownFile(file) {
  const content = await readFile(file, "utf8");
  return parseMarkdown(content, file);
}

export function parseMarkdown(content, file = "<memory>") {
  const source = content.startsWith("\uFEFF") ? content.slice(1) : content;
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/);
  if (!match) {
    throw new FrontMatterError(file, "$", "Markdown file is missing YAML front matter.");
  }

  return {
    file,
    frontmatter: parseFrontmatter(match[1], file),
    body: match[2] ?? ""
  };
}

export function serializeFrontmatter(value, file = "<memory>") {
  const normalized = normalizeJsonValue(value, file);
  if (!isMappingValue(normalized)) {
    throw new FrontMatterError(file, "$", "Front matter must be a YAML mapping.");
  }

  try {
    return stringify(normalized, {
      ...YAML_OPTIONS,
      aliasDuplicateObjects: false,
      indent: 2,
      lineWidth: 0
    });
  } catch (error) {
    throw asFrontMatterError(error, file, "Unable to serialize front matter");
  }
}

export class FrontMatterError extends Error {
  constructor(file, field, message) {
    super(`${file}: ${field}: ${message}`);
    this.name = "FrontMatterError";
    this.file = file;
    this.field = field;
    this.problem = message;
  }
}

function parseFrontmatter(source, file) {
  if (source.trim() === "") {
    return Object.create(null);
  }

  let document;
  try {
    document = parseDocument(source, YAML_OPTIONS);
  } catch (error) {
    throw asFrontMatterError(error, file, "Invalid YAML front matter");
  }

  const diagnostic = document.errors[0] ?? document.warnings[0];
  if (diagnostic) {
    throw yamlDiagnosticError(diagnostic, file);
  }
  if (!isMap(document.contents)) {
    throw new FrontMatterError(file, "$", "Front matter must be a YAML mapping.");
  }

  assertSupportedYaml(document, file);

  let value;
  try {
    value = document.toJS({ mapAsMap: false, maxAliasCount: 0 });
  } catch (error) {
    throw asFrontMatterError(error, file, "Unable to convert YAML front matter");
  }
  return normalizeJsonValue(value, file);
}

function assertSupportedYaml(document, file) {
  visit(document, {
    Alias() {
      throw new FrontMatterError(
        file,
        "$",
        "YAML anchors and aliases are not supported in OpenDomain front matter."
      );
    },
    Node(_key, node) {
      if (node.anchor) {
        throw new FrontMatterError(
          file,
          "$",
          "YAML anchors and aliases are not supported in OpenDomain front matter."
        );
      }
      if (node.tag) {
        throw new FrontMatterError(
          file,
          "$",
          `YAML tags are not supported in OpenDomain front matter ('${node.tag}').`
        );
      }
    },
    Pair(_key, pair) {
      if (!isScalar(pair.key) || typeof pair.key.value !== "string") {
        throw new FrontMatterError(
          file,
          "$",
          "Front matter mapping keys must be strings."
        );
      }
      assertSupportedKey(pair.key.value, file);
    }
  });
}

function normalizeJsonValue(value, file, ancestors = new WeakSet()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new FrontMatterError(file, "$", "Front matter numbers must be finite JSON values.");
    }
    return value;
  }
  if (typeof value !== "object") {
    throw new FrontMatterError(
      file,
      "$",
      `Front matter contains unsupported non-JSON value type '${typeof value}'.`
    );
  }
  if (ancestors.has(value)) {
    throw new FrontMatterError(file, "$", "Front matter must not contain cyclic values.");
  }

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map((item) => normalizeJsonValue(item, file, ancestors));
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new FrontMatterError(
        file,
        "$",
        `Front matter contains unsupported non-JSON object '${value.constructor?.name ?? "Object"}'.`
      );
    }

    const normalized = Object.create(null);
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string") {
        throw new FrontMatterError(file, "$", "Front matter mapping keys must be strings.");
      }
      assertSupportedKey(key, file);

      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor?.enumerable || !("value" in descriptor)) {
        throw new FrontMatterError(
          file,
          "$",
          `Front matter property '${key}' must be an enumerable data property.`
        );
      }
      Object.defineProperty(normalized, key, {
        value: normalizeJsonValue(descriptor.value, file, ancestors),
        enumerable: true,
        configurable: true,
        writable: true
      });
    }
    return normalized;
  } finally {
    ancestors.delete(value);
  }
}

function assertSupportedKey(key, file) {
  if (UNSAFE_KEYS.has(key)) {
    throw new FrontMatterError(
      file,
      "$",
      `Unsupported front matter key '${key}'; prototype-sensitive and merge keys are not allowed.`
    );
  }
  if (!KEY_PATTERN.test(key)) {
    throw new FrontMatterError(
      file,
      "$",
      `Unsupported front matter key '${key}'; use letters, digits, underscores, or hyphens.`
    );
  }
}

function isMappingValue(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function yamlDiagnosticError(diagnostic, file) {
  const code = diagnostic.code ? ` (${diagnostic.code})` : "";
  return new FrontMatterError(file, "$", `Invalid YAML front matter${code}: ${diagnostic.message}`);
}

function asFrontMatterError(error, file, prefix) {
  if (error instanceof FrontMatterError) {
    return error;
  }
  return new FrontMatterError(file, "$", `${prefix}: ${error.message ?? String(error)}`);
}
