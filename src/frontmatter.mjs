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
    frontmatter: parseYamlMapping(match[1], file, { label: "Front matter" }),
    body: match[2] ?? ""
  };
}

export function serializeFrontmatter(value, file = "<memory>") {
  const normalized = normalizeStructuredValue(value, file, "Front matter");
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

export function parseYamlMapping(source, file = "<memory>", options = {}) {
  const label = options.label ?? "YAML document";
  if (source.trim() === "") {
    return Object.create(null);
  }

  let document;
  try {
    document = parseDocument(source, YAML_OPTIONS);
  } catch (error) {
    throw asFrontMatterError(error, file, `Invalid ${label.toLowerCase()}`);
  }

  const diagnostic = document.errors[0] ?? document.warnings[0];
  if (diagnostic) {
    throw yamlDiagnosticError(diagnostic, file, label);
  }
  if (!isMap(document.contents)) {
    throw new FrontMatterError(file, "$", `${label} must be a YAML mapping.`);
  }

  assertSupportedYaml(document, file, label);

  let value;
  try {
    value = document.toJS({ mapAsMap: false, maxAliasCount: 0 });
  } catch (error) {
    throw asFrontMatterError(
      error,
      file,
      `Unable to convert ${label.toLowerCase()}`
    );
  }
  return normalizeStructuredValue(value, file, label);
}

export function parseJsonMapping(source, file = "<memory>") {
  let value;
  try {
    value = JSON.parse(source);
  } catch (error) {
    throw new FrontMatterError(file, "$", `Invalid JSON document: ${error.message}`);
  }

  const normalized = normalizeStructuredValue(value, file, "JSON document");
  if (!isMappingValue(normalized)) {
    throw new FrontMatterError(file, "$", "JSON document must be an object.");
  }
  return normalized;
}

export function normalizeStructuredValue(value, file = "<memory>", label = "Structured data") {
  return normalizeJsonValue(value, file, new WeakSet(), label);
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

function assertSupportedYaml(document, file, label) {
  visit(document, {
    Alias() {
      throw new FrontMatterError(
        file,
        "$",
        `YAML anchors and aliases are not supported in ${label.toLowerCase()}.`
      );
    },
    Node(_key, node) {
      if (node.anchor) {
        throw new FrontMatterError(
          file,
          "$",
          `YAML anchors and aliases are not supported in ${label.toLowerCase()}.`
        );
      }
      if (node.tag) {
        throw new FrontMatterError(
          file,
          "$",
          `YAML tags are not supported in ${label.toLowerCase()} ('${node.tag}').`
        );
      }
    },
    Pair(_key, pair) {
      if (!isScalar(pair.key) || typeof pair.key.value !== "string") {
        throw new FrontMatterError(
          file,
          "$",
          `${label} mapping keys must be strings.`
        );
      }
      assertSupportedKey(pair.key.value, file, label);
    }
  });
}

function normalizeJsonValue(value, file, ancestors, label) {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new FrontMatterError(file, "$", `${label} numbers must be finite JSON values.`);
    }
    return value;
  }
  if (typeof value !== "object") {
    throw new FrontMatterError(
      file,
      "$",
      `${label} contains unsupported non-JSON value type '${typeof value}'.`
    );
  }
  if (ancestors.has(value)) {
    throw new FrontMatterError(file, "$", `${label} must not contain cyclic values.`);
  }

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map((item) => normalizeJsonValue(item, file, ancestors, label));
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new FrontMatterError(
        file,
        "$",
        `${label} contains unsupported non-JSON object '${value.constructor?.name ?? "Object"}'.`
      );
    }

    const normalized = Object.create(null);
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string") {
        throw new FrontMatterError(file, "$", `${label} mapping keys must be strings.`);
      }
      assertSupportedKey(key, file, label);

      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor?.enumerable || !("value" in descriptor)) {
        throw new FrontMatterError(
          file,
          "$",
          `${label} property '${key}' must be an enumerable data property.`
        );
      }
      Object.defineProperty(normalized, key, {
        value: normalizeJsonValue(descriptor.value, file, ancestors, label),
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

function assertSupportedKey(key, file, label) {
  if (UNSAFE_KEYS.has(key)) {
    throw new FrontMatterError(
      file,
      "$",
      `Unsupported ${label.toLowerCase()} key '${key}'; prototype-sensitive and merge keys are not allowed.`
    );
  }
  if (!KEY_PATTERN.test(key)) {
    throw new FrontMatterError(
      file,
      "$",
      `Unsupported ${label.toLowerCase()} key '${key}'; use letters, digits, underscores, or hyphens.`
    );
  }
}

function isMappingValue(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function yamlDiagnosticError(diagnostic, file, label) {
  const code = diagnostic.code ? ` (${diagnostic.code})` : "";
  return new FrontMatterError(file, "$", `Invalid ${label.toLowerCase()}${code}: ${diagnostic.message}`);
}

function asFrontMatterError(error, file, prefix) {
  if (error instanceof FrontMatterError) {
    return error;
  }
  return new FrontMatterError(file, "$", `${prefix}: ${error.message ?? String(error)}`);
}
