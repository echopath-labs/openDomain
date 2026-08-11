import assert from "node:assert/strict";
import test from "node:test";
import { analyzeGovernance } from "../src/governance-graph.mjs";

test("valid public dependency closure is deterministic and excludes private groups", () => {
  const governance = fixture();
  const files = new Map([
    ["alpha.public", ["opendomain/products/alpha/public/contexts/alpha.md"]],
    ["alpha.private", ["opendomain/products/alpha/private/rules/secret.md"]],
    ["beta.public", ["opendomain/products/beta/public/concepts/beta.md"]]
  ]);

  const first = analyzeGovernance(governance, { sourceFilesByGroup: files });
  const second = analyzeGovernance(governance, { sourceFilesByGroup: files });

  assert.deepEqual(first, second);
  assert.deepEqual(first.errors, []);
  assert.deepEqual(first.publication_closures[0].product_ids, ["alpha", "beta"]);
  assert.deepEqual(first.publication_closures[0].domain_group_ids, ["alpha.public", "beta.public"]);
  assert.deepEqual(first.publication_closures[0].source_files, [
    "opendomain/products/alpha/public/contexts/alpha.md",
    "opendomain/products/beta/public/concepts/beta.md"
  ]);
  assert.equal(first.publication_closures[0].source_files.some((file) => file.includes("secret")), false);
});

test("product and group dependency cycles fail independently with stable paths", () => {
  const governance = fixture();
  governance.products[1].dependencies = ["alpha"];
  governance.domainGroups.find((group) => group.id === "beta.public").dependencies = ["alpha.public"];

  const result = analyzeGovernance(governance);

  assert.equal(result.publication_closures.length, 0);
  assert.ok(result.errors.some((error) => (
    error.code === "dependency_cycle" && error.problem.includes("Product")
  )));
  assert.ok(result.errors.some((error) => (
    error.code === "dependency_cycle" && error.problem.includes("Domain group")
  )));
  assert.ok(result.errors.some((error) => error.problem.includes("alpha -> beta -> alpha")));
  assert.ok(result.errors.some((error) => error.problem.includes("alpha.public -> beta.public -> alpha.public")));
});

test("graph rejects missing targets, self dependencies, and undeclared cross-product edges", () => {
  const governance = fixture();
  governance.products[0].dependencies = ["alpha", "missing"];
  governance.domainGroups.find((group) => group.id === "alpha.public").dependencies = ["beta.public"];

  const result = analyzeGovernance(governance);

  assert.ok(result.errors.some((error) => error.code === "self_dependency"));
  assert.ok(result.errors.some((error) => error.code === "missing_dependency_target"));
  assert.ok(result.errors.some((error) => error.code === "undeclared_product_dependency"));
});

test("exposure leaks and groups more public than their products fail closed", () => {
  const governance = fixture();
  governance.products[1].exposure = "private";
  const betaGroup = governance.domainGroups.find((group) => group.id === "beta.public");
  betaGroup.exposure = "public";

  const result = analyzeGovernance(governance);

  assert.ok(result.errors.some((error) => error.code === "exposure_leak"));
  assert.ok(result.errors.some((error) => error.code === "group_more_public_than_product"));
  assert.deepEqual(result.publication_closures, []);
});

test("transitive forbidden dependencies report the reproducible path", () => {
  const governance = fixture();
  governance.products.push(node("gamma", "public"));
  governance.products[1].dependencies = ["gamma"];
  governance.products[0].forbidden_dependencies = ["gamma"];
  governance.domainGroups.push(group("gamma.public", "gamma", "public"));

  const result = analyzeGovernance(governance);

  const error = result.errors.find((entry) => entry.code === "forbidden_dependency");
  assert.ok(error);
  assert.match(error.problem, /alpha -> beta -> gamma/);
});

test("unknown forbidden targets fail before closure", () => {
  const governance = fixture();
  governance.products[0].forbidden_dependencies = ["missing"];

  const result = analyzeGovernance(governance);

  assert.ok(result.errors.some((error) => error.code === "missing_forbidden_dependency_target"));
  assert.deepEqual(result.publication_closures, []);
});

function fixture() {
  return {
    file: "opendomain/governance.yaml",
    manifest: { schema_version: "1.0" },
    products: [
      { ...node("alpha", "public"), dependencies: ["beta"] },
      node("beta", "public")
    ],
    domainGroups: [
      { ...group("alpha.public", "alpha", "public"), dependencies: ["beta.public"] },
      group("alpha.private", "alpha", "private"),
      group("beta.public", "beta", "public")
    ]
  };
}

function node(id, exposure) {
  return {
    id,
    owners: [`${id}-owner`],
    exposure,
    dependencies: [],
    forbidden_dependencies: []
  };
}

function group(id, product, exposure) {
  return {
    ...node(id, exposure),
    product,
    source_root: `products/${product}/${id.split(".").at(-1)}`
  };
}
