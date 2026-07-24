import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const DEFAULT_SCHEMA_DIRECTORY = new URL("../schemas/", import.meta.url);
const SCHEMA_ID_PREFIX = "https://opendomain.dev/schemas/";

const SCHEMA_DEFINITIONS = Object.freeze({
  profile: "integration-profile.schema.json",
  declaration: "domain-declaration.schema.json",
  request: "grounding-request.schema.json"
});

let defaultRegistry;

export class IntegrationSchemaRegistryError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.name = "IntegrationSchemaRegistryError";
  }
}

export function getDefaultIntegrationSchemaRegistry() {
  if (!defaultRegistry) {
    defaultRegistry = createIntegrationSchemaRegistry();
  }
  return defaultRegistry;
}

export function createIntegrationSchemaRegistry(options = {}) {
  const schemaDirectory = normalizeSchemaDirectory(
    options.schemaDirectory ?? DEFAULT_SCHEMA_DIRECTORY
  );
  const schemas = Object.entries(SCHEMA_DEFINITIONS).map(([kind, file]) => ({
    kind,
    file,
    id: `${SCHEMA_ID_PREFIX}${file}`,
    schema: readPackagedSchema(schemaDirectory, file)
  }));

  for (const entry of schemas) {
    if (entry.schema.$id !== entry.id) {
      throw new IntegrationSchemaRegistryError(
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

  try {
    for (const entry of schemas) {
      ajv.addSchema(entry.schema);
    }
  } catch (error) {
    throw new IntegrationSchemaRegistryError(
      `Packaged integration schemas could not be registered: ${error.message}`,
      { cause: error }
    );
  }

  const validators = new Map();
  try {
    for (const entry of schemas) {
      const validate = ajv.getSchema(entry.id);
      if (!validate) {
        throw new Error(`No compiled validator for '${entry.file}'.`);
      }
      validators.set(entry.kind, {
        file: entry.file,
        validate
      });
    }
  } catch (error) {
    throw new IntegrationSchemaRegistryError(
      `Packaged integration schemas could not be compiled: ${error.message}`,
      { cause: error }
    );
  }

  return Object.freeze({
    validate(kind, value) {
      const entry = validators.get(kind);
      if (!entry) {
        throw new IntegrationSchemaRegistryError(
          `No integration schema is registered for kind '${kind}'.`
        );
      }
      const valid = entry.validate(value);
      return {
        valid,
        schemaFile: entry.file,
        errors: valid ? [] : cloneAjvErrors(entry.validate.errors)
      };
    }
  });
}

export function validateIntegrationValue(kind, value, registry = getDefaultIntegrationSchemaRegistry()) {
  const validation = registry.validate(kind, value);
  if (validation.valid) {
    return [];
  }

  return validation.errors
    .filter((error) => !["if", "not", "oneOf", "anyOf"].includes(error.keyword))
    .map((error) => toSchemaIssue(error, validation.schemaFile))
    .filter(uniqueIssue)
    .sort(compareIssues);
}

function readPackagedSchema(schemaDirectory, file) {
  let source;
  try {
    source = readFileSync(new URL(file, schemaDirectory), "utf8");
  } catch (error) {
    throw new IntegrationSchemaRegistryError(
      `Packaged schema '${file}' could not be read: ${error.message}`,
      { cause: error }
    );
  }

  try {
    return JSON.parse(source);
  } catch (error) {
    throw new IntegrationSchemaRegistryError(
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

function toSchemaIssue(error, schemaFile) {
  const field = fieldFromAjvError(error);
  const subject = field === "$" ? "Value" : `Field '${field}'`;

  return {
    severity: "error",
    field,
    problem: `${subject} violates schemas/${schemaFile}: ${schemaErrorDetail(error)}.`,
    fix: field === "$"
      ? `Update the value to satisfy schemas/${schemaFile}.`
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
    case "pattern":
      return "does not match the required pattern";
    case "required":
      return "is required";
    case "type":
      return `must be ${error.params.type}`;
    default:
      return String(error.message ?? `failed the '${error.keyword}' constraint`)
        .replace(/[.]+$/, "");
  }
}

function uniqueIssue(issue, index, issues) {
  return issues.findIndex((candidate) => (
    candidate.field === issue.field
    && candidate.keyword === issue.keyword
    && candidate.problem === issue.problem
  )) === index;
}

function compareIssues(left, right) {
  return compareText(left.field, right.field)
    || compareText(left.problem, right.problem);
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}
