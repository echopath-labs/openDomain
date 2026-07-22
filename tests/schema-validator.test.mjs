import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { validatePath } from "../src/validator.mjs";

const VALID_TARGET = "examples/erp/domain/contexts";

for (const failure of [
  {
    name: "missing schema",
    mutate: (schemaDirectory) => rm(path.join(schemaDirectory, "rule.schema.json")),
    expected: "could not be read"
  },
  {
    name: "malformed schema",
    mutate: (schemaDirectory) => writeFile(
      path.join(schemaDirectory, "rule.schema.json"),
      "{ not-json",
      "utf8"
    ),
    expected: "is not valid JSON"
  },
  {
    name: "schema that fails meta-schema validation",
    mutate: async (schemaDirectory) => {
      const file = path.join(schemaDirectory, "rule.schema.json");
      const schema = JSON.parse(await readFile(file, "utf8"));
      schema.properties.id.type = "not-a-json-schema-type";
      await writeFile(file, `${JSON.stringify(schema, null, 2)}\n`, "utf8");
    },
    expected: "could not be registered"
  },
  {
    name: "schema with an unresolved reference",
    mutate: async (schemaDirectory) => {
      const file = path.join(schemaDirectory, "opendomain.schema.json");
      const schema = JSON.parse(await readFile(file, "utf8"));
      schema.oneOf[0].$ref = "./missing.schema.json";
      await writeFile(file, `${JSON.stringify(schema, null, 2)}\n`, "utf8");
    },
    expected: "could not be compiled"
  }
]) {
  test(`runtime schema registry fails closed for ${failure.name}`, async (context) => {
    const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "opendomain-schemas-"));
    const schemaDirectory = path.join(temporaryRoot, "schemas");
    context.after(() => rm(temporaryRoot, { recursive: true, force: true }));

    await cp(path.resolve("schemas"), schemaDirectory, { recursive: true });
    await failure.mutate(schemaDirectory);

    const result = await validatePath(VALID_TARGET, {
      cwd: process.cwd(),
      schemaDirectory
    });

    assert.equal(result.documents.length, 0);
    assert.equal(result.warnings.length, 0);
    assert.equal(result.errors.length, 1);
    assert.equal(result.errors[0].file, "schemas");
    assert.equal(result.errors[0].field, "$");
    assert.match(result.errors[0].problem, /Runtime schema registry is unavailable/);
    assert.ok(result.errors[0].problem.includes(failure.expected));
  });
}
