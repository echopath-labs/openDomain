import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { readPackagedText } from "./packaged-resources.mjs";

let validator;

export function validateContextExportEnvelope(envelope) {
  const validate = getValidator();
  const valid = validate(envelope);
  return {
    valid,
    errors: valid ? [] : (validate.errors ?? []).map((error) => ({
      instancePath: error.instancePath,
      keyword: error.keyword,
      message: error.message,
      params: { ...error.params },
      schemaPath: error.schemaPath
    }))
  };
}

export function assertContextExportEnvelope(envelope) {
  const result = validateContextExportEnvelope(envelope);
  if (!result.valid) {
    const detail = result.errors
      .map((error) => `${error.instancePath || "$"} ${error.message}`)
      .join("; ");
    throw new Error(`Internal context export violates schemas/context-export.schema.json: ${detail}`);
  }
  return envelope;
}

function getValidator() {
  if (validator) {
    return validator;
  }
  const schema = JSON.parse(readPackagedText("schemas/context-export.schema.json"));
  const ajv = new Ajv2020({
    allErrors: true,
    strict: true,
    strictTypes: false,
    validateFormats: true
  });
  addFormats(ajv, { mode: "full" });
  validator = ajv.compile(schema);
  return validator;
}
