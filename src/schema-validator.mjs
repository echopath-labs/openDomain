import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const DEFAULT_SCHEMA_DIRECTORY = new URL("../schemas/", import.meta.url);
const SCHEMA_ID_PREFIX = "https://opendomain.dev/schemas/";

const DOMAIN_SCHEMA_DEFINITIONS = Object.freeze([
  Object.freeze({ type: "bounded_context", file: "context.schema.json" }),
  Object.freeze({ type: "domain_concept", file: "concept.schema.json" }),
  Object.freeze({ type: "business_rule", file: "rule.schema.json" }),
  Object.freeze({ type: "lifecycle", file: "lifecycle.schema.json" }),
  Object.freeze({ type: "domain_event", file: "event.schema.json" }),
  Object.freeze({ type: "domain_candidate", file: "candidate.schema.json" })
]);

const AGGREGATE_SCHEMA_FILE = "opendomain.schema.json";

export const DOMAIN_SOURCE_TYPES = Object.freeze(
  DOMAIN_SCHEMA_DEFINITIONS.map((definition) => definition.type)
);

let defaultRegistry;

export class DomainSchemaRegistryError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.name = "DomainSchemaRegistryError";
  }
}

export function getDefaultDomainSchemaRegistry() {
  if (!defaultRegistry) {
    defaultRegistry = createDomainSchemaRegistry();
  }
  return defaultRegistry;
}

export function createDomainSchemaRegistry(options = {}) {
  const schemaDirectory = normalizeSchemaDirectory(
    options.schemaDirectory ?? DEFAULT_SCHEMA_DIRECTORY
  );
  const definitions = [
    ...DOMAIN_SCHEMA_DEFINITIONS,
    { type: null, file: AGGREGATE_SCHEMA_FILE }
  ];
  const schemas = definitions.map((definition) => ({
    ...definition,
    id: `${SCHEMA_ID_PREFIX}${definition.file}`,
    schema: readPackagedSchema(schemaDirectory, definition.file)
  }));

  for (const entry of schemas) {
    if (entry.schema.$id !== entry.id) {
      throw new DomainSchemaRegistryError(
        `Packaged schema '${entry.file}' has unexpected $id '${entry.schema.$id ?? "missing"}'.`
      );
    }
  }

  const ajv = new Ajv2020({
    allErrors: true,
    coerceTypes: false,
    removeAdditional: false,
    strict: true,
    strictRequired: false,
    strictTypes: false,
    useDefaults: false,
    validateFormats: true,
    validateSchema: true
  });
  addFormats(ajv, { mode: "full" });

  try {
    for (const entry of schemas) {
      ajv.addSchema(entry.schema);
    }
  } catch (error) {
    throw new DomainSchemaRegistryError(
      `Packaged OpenDomain schemas could not be registered: ${error.message}`,
      { cause: error }
    );
  }

  const validators = new Map();
  try {
    for (const definition of DOMAIN_SCHEMA_DEFINITIONS) {
      const id = `${SCHEMA_ID_PREFIX}${definition.file}`;
      const validator = ajv.getSchema(id);
      if (!validator) {
        throw new Error(`No compiled validator for '${definition.file}'.`);
      }
      validators.set(definition.type, {
        file: definition.file,
        validate: validator
      });
    }

    const aggregateId = `${SCHEMA_ID_PREFIX}${AGGREGATE_SCHEMA_FILE}`;
    if (!ajv.getSchema(aggregateId)) {
      throw new Error(`No compiled validator for '${AGGREGATE_SCHEMA_FILE}'.`);
    }
  } catch (error) {
    throw new DomainSchemaRegistryError(
      `Packaged OpenDomain schemas could not be compiled: ${error.message}`,
      { cause: error }
    );
  }

  return Object.freeze({
    validate(type, frontmatter) {
      const entry = validators.get(type);
      if (!entry) {
        throw new DomainSchemaRegistryError(`No runtime schema is registered for type '${type}'.`);
      }

      const valid = entry.validate(frontmatter);
      return {
        valid,
        schemaFile: entry.file,
        errors: valid ? [] : cloneAjvErrors(entry.validate.errors)
      };
    }
  });
}

export function validateDomainFrontmatter(frontmatter, type, registry) {
  const validation = registry.validate(type, frontmatter);
  if (validation.valid) {
    return [];
  }

  return validation.errors
    .filter((error) => error.keyword !== "if")
    .map((error) => toDomainSchemaIssue(error, validation.schemaFile))
    .sort(compareSchemaIssues);
}

function readPackagedSchema(schemaDirectory, file) {
  let source;
  try {
    source = readFileSync(new URL(file, schemaDirectory), "utf8");
  } catch (error) {
    throw new DomainSchemaRegistryError(
      `Packaged schema '${file}' could not be read: ${error.message}`,
      { cause: error }
    );
  }

  try {
    return JSON.parse(source);
  } catch (error) {
    throw new DomainSchemaRegistryError(
      `Packaged schema '${file}' is not valid JSON: ${error.message}`,
      { cause: error }
    );
  }
}

function normalizeSchemaDirectory(schemaDirectory) {
  if (schemaDirectory instanceof URL) {
    const normalized = new URL(schemaDirectory.href);
    if (!normalized.pathname.endsWith("/")) {
      normalized.pathname += "/";
    }
    return normalized;
  }

  const absolutePath = path.resolve(String(schemaDirectory));
  return pathToFileURL(`${absolutePath}${path.sep}`);
}

function cloneAjvErrors(errors) {
  return (errors ?? []).map((error) => ({
    instancePath: error.instancePath,
    keyword: error.keyword,
    message: error.message,
    params: { ...error.params },
    schemaPath: error.schemaPath
  }));
}

function toDomainSchemaIssue(error, schemaFile) {
  const field = fieldFromAjvError(error);
  const subject = field === "$" ? "Front matter" : `Field '${field}'`;
  const detail = schemaErrorDetail(error);

  return {
    field,
    keyword: error.keyword,
    schemaPath: error.schemaPath,
    problem: `${subject} violates schemas/${schemaFile}: ${detail}.`,
    fix: field === "$"
      ? `Update the front matter to satisfy schemas/${schemaFile}.`
      : `Update '${field}' to satisfy schemas/${schemaFile}.`
  };
}

function fieldFromAjvError(error) {
  const segments = decodeJsonPointer(error.instancePath);

  if (error.keyword === "required" && error.params.missingProperty) {
    segments.push(error.params.missingProperty);
  } else if (error.keyword === "additionalProperties" && error.params.additionalProperty) {
    segments.push(error.params.additionalProperty);
  } else if (error.keyword === "propertyNames" && error.params.propertyName) {
    segments.push(error.params.propertyName);
  }

  return formatFieldPath(segments);
}

function decodeJsonPointer(pointer) {
  if (!pointer) {
    return [];
  }
  return pointer
    .slice(1)
    .split("/")
    .map((segment) => segment.replaceAll("~1", "/").replaceAll("~0", "~"));
}

function formatFieldPath(segments) {
  let field = "";
  for (const segment of segments) {
    if (/^(0|[1-9][0-9]*)$/.test(segment)) {
      field += `[${segment}]`;
    } else {
      field += field ? `.${segment}` : segment;
    }
  }
  return field || "$";
}

function schemaErrorDetail(error) {
  switch (error.keyword) {
    case "const":
      return `must equal '${String(error.params.allowedValue)}'`;
    case "enum":
      return `must be one of ${error.params.allowedValues.map(String).join(", ")}`;
    case "format":
      return `must use the '${error.params.format}' format`;
    case "pattern":
      return "does not match the required pattern";
    case "required":
      return "is required";
    case "type":
      return `must be ${error.params.type}`;
    default:
      return stripTrailingPeriod(error.message ?? `failed the '${error.keyword}' constraint`);
  }
}

function stripTrailingPeriod(value) {
  return String(value).replace(/[.]+$/, "");
}

function compareSchemaIssues(left, right) {
  return compareText(left.field, right.field)
    || compareText(left.keyword, right.keyword)
    || compareText(left.schemaPath, right.schemaPath)
    || compareText(left.problem, right.problem);
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}
