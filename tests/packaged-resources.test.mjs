import assert from "node:assert/strict";
import test from "node:test";

test("packaged resources expose schemas, package metadata, and ERP files", async () => {
  let resources;
  try {
    resources = await import("../src/packaged-resources.mjs");
  } catch (error) {
    assert.fail(`Packaged resource boundary is unavailable: ${error.code ?? error.message}`);
  }

  const packageMetadata = JSON.parse(resources.readPackagedText("package.json"));
  const installationContract = resources.readPackagedText("INSTALL.md");
  const schema = JSON.parse(resources.readPackagedText("schemas/context.schema.json"));
  const exampleFiles = resources.listPackagedFiles("examples/erp/");

  assert.equal(packageMetadata.name, "@echopath-labs/opendomain");
  assert.match(installationContract, /OpenDomain Agent Installation Contract/);
  assert.match(installationContract, /@echopath-labs\/opendomain@alpha/);
  assert.equal(schema.$id, "https://opendomain.dev/schemas/context.schema.json");
  assert.ok(exampleFiles.includes("examples/erp/opendomain/contexts/sales.md"));
  assert.ok(exampleFiles.includes("examples/erp/openspec/changes/order-cancellation/spec.md"));
  assert.deepEqual(exampleFiles, [...exampleFiles].sort());
});

test("packaged resources reject paths outside the declared package boundary", async () => {
  let resources;
  try {
    resources = await import("../src/packaged-resources.mjs");
  } catch (error) {
    assert.fail(`Packaged resource boundary is unavailable: ${error.code ?? error.message}`);
  }

  for (const unsafePath of [
    "../package.json",
    "%2e%2e/package.json",
    "/package.json",
    "schemas\\context.schema.json",
    "schemas/context.schema.json?raw=true",
    "schemas/context.schema.json#fragment",
    ""
  ]) {
    assert.throws(
      () => resources.readPackagedText(unsafePath),
      /safe package-relative path/
    );
  }
});
