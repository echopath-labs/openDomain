import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  GOVERNANCE_SCHEMA_VERSION,
  loadGovernanceManifest
} from "../src/governance.mjs";

test("governance loader returns an explicit absent state", async (context) => {
  const workspace = await temporaryWorkspace(context);
  const result = await loadGovernanceManifest(workspace, { displayPath: "opendomain" });

  assert.equal(result.present, false);
  assert.equal(result.valid, true);
  assert.equal(result.manifest, null);
  assert.deepEqual(result.errors, []);
});

test("governance loader normalizes a valid version 1.0 manifest", async (context) => {
  const workspace = await temporaryWorkspace(context);
  await writeManifest(workspace, validManifest());

  const result = await loadGovernanceManifest(workspace, { displayPath: "opendomain" });

  assert.equal(result.present, true);
  assert.equal(result.valid, true);
  assert.equal(result.manifest.schema_version, GOVERNANCE_SCHEMA_VERSION);
  assert.deepEqual(result.products.map((product) => product.id), ["echopath", "opendomain"]);
  assert.deepEqual(result.domainGroups.map((group) => group.id), [
    "echopath.context_governance",
    "opendomain.core"
  ]);
});

for (const invalid of [
  {
    name: "unknown field",
    mutate(manifest) {
      manifest.products[0].unexpected = true;
    },
    field: "products[0].unexpected"
  },
  {
    name: "missing owners",
    mutate(manifest) {
      delete manifest.products[0].owners;
    },
    field: "products[0].owners"
  },
  {
    name: "unknown exposure",
    mutate(manifest) {
      manifest.domain_groups[0].exposure = "partner";
    },
    field: "domain_groups[0].exposure"
  }
]) {
  test(`governance loader fails closed for ${invalid.name}`, async (context) => {
    const workspace = await temporaryWorkspace(context);
    const manifest = validManifest();
    invalid.mutate(manifest);
    await writeManifest(workspace, manifest);

    const result = await loadGovernanceManifest(workspace, { displayPath: "opendomain" });

    assert.equal(result.valid, false);
    assert.ok(result.errors.some((error) => error.field === invalid.field));
  });
}

test("governance loader rejects unknown versions before schema evaluation", async (context) => {
  const workspace = await temporaryWorkspace(context);
  const manifest = validManifest();
  manifest.schema_version = "2.0";
  await writeManifest(workspace, manifest);

  const result = await loadGovernanceManifest(workspace, { displayPath: "opendomain" });

  assert.equal(result.valid, false);
  assert.deepEqual(result.errors.map((error) => error.field), ["schema_version"]);
  assert.match(result.errors[0].problem, /Unsupported governance schema version/);
});

test("governance loader rejects duplicate product and group identities", async (context) => {
  const workspace = await temporaryWorkspace(context);
  const manifest = validManifest();
  manifest.products.push(structuredClone(manifest.products[0]));
  manifest.domain_groups.push(structuredClone(manifest.domain_groups[0]));
  await writeManifest(workspace, manifest);

  const result = await loadGovernanceManifest(workspace, { displayPath: "opendomain" });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.problem.includes("Duplicate product id")));
  assert.ok(result.errors.some((error) => error.problem.includes("Duplicate domain group id")));
});

test("governance loader rejects missing parents and invalid group namespaces", async (context) => {
  const workspace = await temporaryWorkspace(context);
  const manifest = validManifest();
  manifest.domain_groups[0].product = "missing";
  await writeManifest(workspace, manifest);

  const result = await loadGovernanceManifest(workspace, { displayPath: "opendomain" });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.problem.includes("unknown product")));
  assert.ok(result.errors.some((error) => error.problem.includes("outside product namespace")));
});

async function temporaryWorkspace(context) {
  const root = await mkdtemp(path.join(os.tmpdir(), "opendomain-governance-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const workspace = path.join(root, "opendomain");
  await mkdir(workspace, { recursive: true });
  return workspace;
}

async function writeManifest(workspace, manifest) {
  await writeFile(
    path.join(workspace, "governance.yaml"),
    toYaml(manifest),
    "utf8"
  );
}

function validManifest() {
  return {
    schema_version: "1.0",
    products: [
      {
        id: "opendomain",
        owners: ["opendomain-maintainer"],
        exposure: "public",
        dependencies: [],
        forbidden_dependencies: ["echopath"]
      },
      {
        id: "echopath",
        owners: ["echopath-maintainer"],
        exposure: "private",
        dependencies: ["opendomain"],
        forbidden_dependencies: []
      }
    ],
    domain_groups: [
      {
        id: "opendomain.core",
        product: "opendomain",
        source_root: "products/opendomain/core",
        owners: ["opendomain-maintainer"],
        exposure: "public",
        dependencies: [],
        forbidden_dependencies: ["echopath.context_governance"]
      },
      {
        id: "echopath.context_governance",
        product: "echopath",
        source_root: "products/echopath/context-governance",
        owners: ["echopath-maintainer"],
        exposure: "private",
        dependencies: ["opendomain.core"],
        forbidden_dependencies: []
      }
    ]
  };
}

function toYaml(value) {
  const lines = [`schema_version: "${value.schema_version}"`, "products:"];
  for (const product of value.products) {
    lines.push(`  - id: ${product.id}`);
    lines.push(`    owners: [${(product.owners ?? []).join(", ")}]`);
    lines.push(`    exposure: ${product.exposure}`);
    lines.push(`    dependencies: [${product.dependencies.join(", ")}]`);
    lines.push(`    forbidden_dependencies: [${product.forbidden_dependencies.join(", ")}]`);
    if (product.unexpected !== undefined) {
      lines.push(`    unexpected: ${String(product.unexpected)}`);
    }
    if (product.owners === undefined) {
      lines.splice(lines.length - (product.unexpected !== undefined ? 5 : 4), 1);
    }
  }
  lines.push("domain_groups:");
  for (const group of value.domain_groups) {
    lines.push(`  - id: ${group.id}`);
    lines.push(`    product: ${group.product}`);
    lines.push(`    source_root: ${group.source_root}`);
    lines.push(`    owners: [${group.owners.join(", ")}]`);
    lines.push(`    exposure: ${group.exposure}`);
    lines.push(`    dependencies: [${group.dependencies.join(", ")}]`);
    lines.push(`    forbidden_dependencies: [${group.forbidden_dependencies.join(", ")}]`);
  }
  return `${lines.join("\n")}\n`;
}
