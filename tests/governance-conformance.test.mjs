import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { runCli } from "../src/cli.mjs";
import { parseYamlMapping } from "../src/frontmatter.mjs";
import { validatePath } from "../src/validator.mjs";

const INVALID_ROOT = path.resolve("tests/fixtures/governance/invalid");

for (const fixture of [
  { name: "product-cycle", code: "dependency_cycle", problem: "Product dependency cycle" },
  { name: "group-cycle", code: "dependency_cycle", problem: "Domain group dependency cycle" },
  { name: "undeclared-cross-product", code: "undeclared_product_dependency" },
  { name: "forbidden-direct", code: "forbidden_dependency", problem: "alpha -> beta" },
  { name: "forbidden-transitive", code: "forbidden_dependency", problem: "alpha -> beta -> gamma" },
  { name: "exposure-leak", code: "exposure_leak" },
  { name: "unknown-exposure", field: "products[0].exposure" },
  { name: "missing-target", code: "missing_dependency_target" },
  { name: "overlapping-roots", problem: "overlap" },
  { name: "unassigned-source", problem: "outside every declared" }
]) {
  test(`isolated invalid governance fixture fails closed: ${fixture.name}`, async (context) => {
    const project = await materializeFixture(context, fixture.name);
    const first = await validatePath(undefined, { cwd: project });
    const second = await validatePath(undefined, { cwd: project });

    assert.deepEqual(first, second);
    assert.ok(first.errors.length > 0);
    assert.deepEqual(first.governance?.publication_closures ?? [], []);
    if (fixture.code) {
      assert.ok(first.errors.some((error) => error.code === fixture.code));
    }
    if (fixture.field) {
      assert.ok(first.errors.some((error) => error.field === fixture.field));
    }
    if (fixture.problem) {
      assert.ok(first.errors.some((error) => error.problem.includes(fixture.problem)));
    }
  });
}

test("CLI JSON and human output preserve equivalent exposure-leak diagnostics", async (context) => {
  const project = await materializeFixture(context, "exposure-leak");
  const direct = await validatePath(undefined, { cwd: project });
  const jsonOut = memoryStream();
  const jsonCode = await runCli(["validate", "--json"], {
    cwd: project,
    stdout: jsonOut,
    stderr: memoryStream()
  });
  const payload = JSON.parse(jsonOut.toString());
  const humanOut = memoryStream();
  const humanCode = await runCli(["validate"], {
    cwd: project,
    stdout: humanOut,
    stderr: memoryStream()
  });
  const exposureIssue = direct.errors.find((error) => error.code === "exposure_leak");

  assert.equal(jsonCode, 1);
  assert.equal(humanCode, 1);
  assert.deepEqual(payload.errors, direct.errors);
  assert.match(humanOut.toString(), new RegExp(escapeRegExp(exposureIssue.problem)));
  assert.match(humanOut.toString(), new RegExp(escapeRegExp(exposureIssue.field)));
  assert.match(humanOut.toString(), new RegExp(escapeRegExp(exposureIssue.fix)));
});

async function materializeFixture(context, name) {
  const root = await mkdtemp(path.join(os.tmpdir(), `opendomain-${name}-`));
  context.after(() => rm(root, { recursive: true, force: true }));
  const workspace = path.join(root, "opendomain");
  await mkdir(workspace, { recursive: true });
  const source = await readFile(path.join(INVALID_ROOT, `${name}.yaml`), "utf8");
  await writeFile(path.join(workspace, "governance.yaml"), source, "utf8");
  const manifest = parseYamlMapping(source, `${name}.yaml`, { label: "Governance fixture" });

  for (const group of manifest.domain_groups ?? []) {
    const id = group.id.replaceAll(".", "_").replaceAll("-", "_");
    const file = path.join(workspace, group.source_root, "contexts", `${id}.md`);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, contextDocument(id), "utf8");
  }
  if (name === "unassigned-source") {
    const file = path.join(workspace, "orphan/contexts/unassigned.md");
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, contextDocument("unassigned"), "utf8");
  }
  return root;
}

function contextDocument(id) {
  return `---
type: bounded_context
id: ${id}
name: ${id}
status: accepted
owners: [fixture-owner]
evidence:
  - type: human_review
    location: synthetic:governance-invalid-fixture
    summary: Synthetic source used to reach governance validation.
    confidence: high
review:
  state: accepted
  reviewed_by: fixture-maintainer
  reviewed_at: 2026-08-10
---

# ${id}
`;
}

function memoryStream() {
  let value = "";
  return {
    write(chunk) {
      value += chunk;
    },
    toString() {
      return value;
    }
  };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
