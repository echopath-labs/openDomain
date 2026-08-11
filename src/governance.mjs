import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { parseYamlMapping, FrontMatterError } from "./frontmatter.mjs";
import { readPackagedText } from "./packaged-resources.mjs";

export const GOVERNANCE_MANIFEST_NAME = "governance.yaml";
export const GOVERNANCE_SCHEMA_FILE = "governance.schema.json";
export const GOVERNANCE_SCHEMA_VERSION = "1.0";
export const GOVERNANCE_SCHEMA_ID = "https://opendomain.dev/schemas/governance.schema.json";
export const EXPOSURE_ORDER = Object.freeze([
  "public",
  "ecosystem",
  "internal",
  "private"
]);

let defaultValidator;

export async function loadGovernanceManifest(workspaceRoot, options = {}) {
  const manifestPath = path.join(workspaceRoot, GOVERNANCE_MANIFEST_NAME);
  const displayPath = options.displayPath
    ? path.posix.join(options.displayPath, GOVERNANCE_MANIFEST_NAME)
    : GOVERNANCE_MANIFEST_NAME;
  const result = {
    present: false,
    valid: true,
    file: displayPath,
    absoluteFile: manifestPath,
    manifest: null,
    products: [],
    domainGroups: [],
    errors: [],
    warnings: []
  };

  let manifestStat;
  try {
    manifestStat = await lstat(manifestPath);
  } catch (error) {
    if (error.code === "ENOENT") {
      return result;
    }
    result.present = true;
    result.valid = false;
    result.errors.push(issue({
      file: displayPath,
      field: "$",
      problem: `Unable to inspect governance manifest: ${error.message}`,
      fix: "Make the manifest readable or remove it to use the ungoverned single-product workspace mode."
    }));
    return result;
  }

  result.present = true;
  if (manifestStat.isSymbolicLink() || !manifestStat.isFile()) {
    result.valid = false;
    result.errors.push(issue({
      file: displayPath,
      field: "$",
      problem: manifestStat.isSymbolicLink()
        ? "Governance manifest must not be a symbolic link."
        : "Governance manifest must be a regular YAML file.",
      fix: `Replace '${displayPath}' with a regular file inside the canonical workspace.`
    }));
    return result;
  }

  let manifest;
  try {
    manifest = parseYamlMapping(
      await readFile(manifestPath, "utf8"),
      displayPath,
      { label: "Governance manifest" }
    );
  } catch (error) {
    result.valid = false;
    result.errors.push(issue({
      file: displayPath,
      field: error instanceof FrontMatterError ? error.field : "$",
      problem: error instanceof FrontMatterError
        ? error.problem
        : `Unable to parse governance manifest: ${error.message}`,
      fix: "Use a plain YAML mapping without aliases, tags, merge keys, or unsafe property names."
    }));
    return result;
  }

  if (manifest.schema_version !== GOVERNANCE_SCHEMA_VERSION) {
    result.valid = false;
    result.errors.push(issue({
      file: displayPath,
      field: "schema_version",
      problem: `Unsupported governance schema version '${String(manifest.schema_version ?? "missing")}'.`,
      fix: `Use schema_version: "${GOVERNANCE_SCHEMA_VERSION}" with this OpenDomain version.`
    }));
    return result;
  }

  const validate = options.validate ?? getGovernanceValidator();
  if (!validate(manifest)) {
    result.valid = false;
    result.errors.push(...(validate.errors ?? [])
      .map((error) => schemaIssue(error, displayPath))
      .sort(compareIssues));
    return result;
  }

  const products = normalizeNodes(manifest.products);
  const domainGroups = normalizeNodes(manifest.domain_groups);
  result.errors.push(...validateNodeIdentity(products, domainGroups, displayPath));
  result.valid = result.errors.length === 0;
  if (!result.valid) {
    return result;
  }

  result.manifest = {
    schema_version: manifest.schema_version,
    products,
    domain_groups: domainGroups
  };
  result.products = products;
  result.domainGroups = domainGroups;
  return result;
}

export function createGovernanceValidator(schema = readGovernanceSchema()) {
  const ajv = new Ajv2020({
    allErrors: true,
    coerceTypes: false,
    removeAdditional: false,
    strict: true,
    strictRequired: false,
    strictTypes: false,
    useDefaults: false,
    validateSchema: true
  });
  ajv.addSchema(schema);
  const validate = ajv.getSchema(GOVERNANCE_SCHEMA_ID);
  if (!validate) {
    throw new Error(`No compiled validator for schemas/${GOVERNANCE_SCHEMA_FILE}.`);
  }
  return validate;
}

function getGovernanceValidator() {
  if (!defaultValidator) {
    defaultValidator = createGovernanceValidator();
  }
  return defaultValidator;
}

function readGovernanceSchema() {
  const schema = JSON.parse(readPackagedText(`schemas/${GOVERNANCE_SCHEMA_FILE}`));
  if (schema.$id !== GOVERNANCE_SCHEMA_ID) {
    throw new Error(`Packaged schema '${GOVERNANCE_SCHEMA_FILE}' has unexpected $id '${schema.$id ?? "missing"}'.`);
  }
  return schema;
}

function normalizeNodes(nodes) {
  return nodes
    .map((node) => ({
      ...node,
      owners: [...node.owners].sort(),
      dependencies: [...node.dependencies].sort(),
      forbidden_dependencies: [...node.forbidden_dependencies].sort()
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function validateNodeIdentity(products, domainGroups, file) {
  const errors = [];
  const productIds = new Set();
  for (let index = 0; index < products.length; index += 1) {
    const product = products[index];
    if (productIds.has(product.id)) {
      errors.push(issue({
        file,
        field: `products[${index}].id`,
        problem: `Duplicate product id '${product.id}'.`,
        fix: "Use one globally unique product id per product declaration."
      }));
    }
    productIds.add(product.id);
  }

  const groupIds = new Set();
  for (let index = 0; index < domainGroups.length; index += 1) {
    const group = domainGroups[index];
    if (groupIds.has(group.id)) {
      errors.push(issue({
        file,
        field: `domain_groups[${index}].id`,
        problem: `Duplicate domain group id '${group.id}'.`,
        fix: "Use one globally unique id per domain group declaration."
      }));
    }
    groupIds.add(group.id);
    if (!productIds.has(group.product)) {
      errors.push(issue({
        file,
        field: `domain_groups[${index}].product`,
        problem: `Domain group '${group.id}' references unknown product '${group.product}'.`,
        fix: "Declare the owning product or correct the product id."
      }));
    }
    if (!group.id.startsWith(`${group.product}.`)) {
      errors.push(issue({
        file,
        field: `domain_groups[${index}].id`,
        problem: `Domain group id '${group.id}' is outside product namespace '${group.product}'.`,
        fix: `Prefix the group id with '${group.product}.'.`
      }));
    }
  }
  return errors.sort(compareIssues);
}

function schemaIssue(error, file) {
  const segments = decodePointer(error.instancePath);
  if (error.keyword === "required" && error.params.missingProperty) {
    segments.push(error.params.missingProperty);
  } else if (error.keyword === "additionalProperties" && error.params.additionalProperty) {
    segments.push(error.params.additionalProperty);
  }
  const field = formatField(segments);
  const detail = error.keyword === "enum"
    ? `must be one of ${(error.params.allowedValues ?? []).join(", ")}`
    : error.keyword === "const"
      ? `must equal '${String(error.params.allowedValue)}'`
      : String(error.message ?? `failed '${error.keyword}'`).replace(/[.]+$/, "");
  return issue({
    file,
    field,
    problem: `Governance manifest field '${field}' violates schemas/${GOVERNANCE_SCHEMA_FILE}: ${detail}.`,
    fix: `Update '${field}' to satisfy schemas/${GOVERNANCE_SCHEMA_FILE}.`
  });
}

function decodePointer(pointer) {
  if (!pointer) {
    return [];
  }
  return pointer.slice(1).split("/").map((segment) => (
    segment.replaceAll("~1", "/").replaceAll("~0", "~")
  ));
}

function formatField(segments) {
  let field = "";
  for (const segment of segments) {
    field += /^(0|[1-9][0-9]*)$/.test(segment)
      ? `[${segment}]`
      : field ? `.${segment}` : segment;
  }
  return field || "$";
}

function issue({ file, field, problem, fix }) {
  return { severity: "error", file, field, problem, fix };
}

function compareIssues(left, right) {
  return left.field.localeCompare(right.field)
    || left.problem.localeCompare(right.problem);
}
