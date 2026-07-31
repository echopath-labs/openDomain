import assert from "node:assert/strict";
import { cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  assureGrounding,
  ASSURANCE_VERSION,
  evaluateGroundingPack
} from "../src/assurance.mjs";
import { runCli } from "../src/cli.mjs";
import { buildGroundingRequest } from "../src/grounding-request.mjs";
import { validateIntegrationValue } from "../src/integration-schema-validator.mjs";
import { emptyGroundingPack, prepareGroundingPack } from "../src/prepare.mjs";

const ERP_ROOT = path.resolve("examples/erp");
const TEST_NOW = new Date("2026-06-30T00:00:00Z");

test("required grounding with accepted IDs is prepared and passes", async (context) => {
  const project = await createProject(context);
  await writeFeature(project, {
    status: "required",
    rationale: "The feature changes accepted order behavior.",
    concepts: ["sales.order"]
  });

  const result = await assureGrounding("feature.md", {
    cwd: project,
    now: TEST_NOW
  });

  assert.equal(result.assurance_version, ASSURANCE_VERSION);
  assert.equal(result.grounding.status, "required");
  assert.equal(result.preparation.state, "prepared");
  assert.equal(result.policy.outcome, "pass");
  assert.ok(result.preparation.accepted_ids.includes("sales.order"));
  assert.deepEqual(validateIntegrationValue("assurance", result), []);
});

test("invalid preparation cannot pass even when an upstream pack omitted diagnostics", () => {
  const result = evaluateGroundingPack(emptyGroundingPack({
    input: "feature.md",
    errors: []
  }));

  assert.equal(result.preparation.state, "invalid");
  assert.equal(result.policy.outcome, "fail");
  assert.deepEqual(validateIntegrationValue("assurance", result), []);

  const inconsistent = {
    ...result,
    policy: {
      ...result.policy,
      outcome: "pass"
    }
  };
  assert.ok(validateIntegrationValue("assurance", inconsistent).length > 0);
});

test("not_required grounding needs a rationale and cannot contain domain IDs", async (context) => {
  const project = await createProject(context);
  await writeFeature(project, {
    status: "not_required",
    rationale: "This change only corrects non-domain documentation."
  });

  const valid = await assureGrounding("feature.md", {
    cwd: project,
    now: TEST_NOW
  });
  assert.equal(valid.preparation.state, "not_required");
  assert.equal(valid.policy.outcome, "pass");

  await writeFeature(project, {
    status: "not_required",
    rationale: "This declaration contradicts its references.",
    concepts: ["sales.order"]
  });
  const contradictoryRequest = await buildGroundingRequest("feature.md", { cwd: project });
  const contradictoryPack = await prepareGroundingPack("feature.md", { cwd: project });
  const contradictory = await assureGrounding("feature.md", { cwd: project });
  assert.equal(contradictoryRequest.request, null);
  assert.ok(contradictoryRequest.errors.some((item) => item.code === "grounding_decision_contradiction"));
  assert.equal(contradictoryPack.grounding_request, null);
  assert.deepEqual(contradictoryPack.read_first, []);
  assert.ok(contradictoryPack.errors.some((item) => item.code === "grounding_decision_contradiction"));
  assert.equal(contradictory.preparation.state, "invalid");
  assert.equal(contradictory.policy.outcome, "fail");
  assert.ok(contradictory.findings.some((item) => item.code === "grounding_decision_contradiction"));

  await writeFeature(project, { status: "not_required" });
  const missingRationale = await assureGrounding("feature.md", { cwd: project });
  assert.equal(missingRationale.preparation.state, "invalid");
  assert.equal(missingRationale.policy.outcome, "fail");
  assert.ok(missingRationale.findings.some((item) => item.code === "grounding_rationale_required"));

  await writeFeature(project, {
    status: "not_required",
    rationale: "A broken ID must not hide this contradiction.",
    concepts: ["sales.missing"]
  });
  const brokenContradiction = await assureGrounding("feature.md", { cwd: project });
  assert.ok(brokenContradiction.findings.some((item) => item.code === "grounding_decision_contradiction"));
  assert.equal(brokenContradiction.grounding_pack.grounding_request, null);
  assert.deepEqual(brokenContradiction.preparation.accepted_ids, []);
});

test("unclassified partial grounding stays incomplete under both policies", async (context) => {
  const project = await createProject(context);
  await writeFeature(project, {
    status: "unclassified",
    concepts: ["sales.order"]
  });

  const advisory = await assureGrounding("feature.md", {
    cwd: project,
    mode: "advisory"
  });
  const enforced = await assureGrounding("feature.md", {
    cwd: project,
    mode: "enforced"
  });

  assert.equal(advisory.preparation.state, "incomplete");
  assert.equal(advisory.policy.outcome, "warn");
  assert.ok(advisory.preparation.accepted_ids.includes("sales.order"));
  assert.equal(enforced.preparation.state, "incomplete");
  assert.equal(enforced.policy.outcome, "fail");
  assert.ok(enforced.preparation.accepted_ids.includes("sales.order"));
  assert.equal(
    enforced.findings.find((item) => item.code === "grounding_unclassified")?.severity,
    "error"
  );
});

test("required grounding without IDs exposes a brownfield domain model gap", async (context) => {
  const project = await createProject(context);
  await writeFeature(project, {
    status: "required",
    rationale: "The affected legacy behavior has not been modeled yet."
  });

  const advisory = await assureGrounding("feature.md", { cwd: project });
  const enforced = await assureGrounding("feature.md", {
    cwd: project,
    mode: "enforced"
  });

  assert.equal(advisory.preparation.state, "incomplete");
  assert.equal(advisory.policy.outcome, "warn");
  assert.ok(advisory.findings.some((item) => item.code === "domain_model_gap"));
  assert.equal(enforced.policy.outcome, "fail");
});

test("an initialized brownfield workspace can expose a model gap before acceptance", async (context) => {
  const project = await mkdtemp(path.join(os.tmpdir(), "opendomain-brownfield-"));
  context.after(() => rm(project, { recursive: true, force: true }));
  const initExit = await runCli(["init", "--json"], {
    cwd: project,
    stdout: memoryStream(),
    stderr: memoryStream()
  });
  assert.equal(initExit, 0);

  await writeFeature(project, {
    status: "required",
    rationale: "The existing domain behavior has not been accepted yet."
  });
  const result = await assureGrounding("feature.md", { cwd: project });

  assert.equal(result.preparation.state, "incomplete");
  assert.equal(result.policy.outcome, "warn");
  assert.deepEqual(result.preparation.accepted_ids, []);
  assert.ok(result.findings.some((item) => item.code === "domain_model_gap"));
});

test("Assurance requires workspace initialization before brownfield classification", async (context) => {
  const project = await mkdtemp(path.join(os.tmpdir(), "opendomain-uninitialized-"));
  context.after(() => rm(project, { recursive: true, force: true }));
  await writeFeature(project, {
    status: "required",
    rationale: "This project has not initialized OpenDomain yet."
  });

  const result = await assureGrounding("feature.md", { cwd: project });

  assert.equal(result.preparation.state, "invalid");
  assert.equal(result.policy.outcome, "fail");
  assert.ok(result.findings.some((item) => (
    item.problem === "No OpenDomain workspace found."
    && item.fix.includes("opendomain init")
  )));
});

test("legacy input is unclassified while malformed decisions are invalid", async (context) => {
  const project = await createProject(context);
  await writeFeature(project, {
    omitGrounding: true,
    concepts: ["sales.order"]
  });

  const request = await buildGroundingRequest("feature.md", { cwd: project });
  assert.equal(request.request.grounding.status, "unclassified");
  assert.ok(request.warnings.some((item) => item.code === "legacy_grounding_status_missing"));

  const legacy = await assureGrounding("feature.md", { cwd: project });
  assert.equal(legacy.preparation.state, "incomplete");
  assert.equal(legacy.policy.outcome, "warn");
  assert.ok(legacy.findings.some((item) => item.code === "legacy_grounding_status_missing"));
  assert.deepEqual(validateIntegrationValue("assurance", legacy), []);

  await writeFeature(project, {
    status: "sometimes",
    concepts: ["sales.order"]
  });
  const malformed = await assureGrounding("feature.md", { cwd: project });
  assert.equal(malformed.grounding.status, null);
  assert.equal(malformed.preparation.state, "invalid");
  assert.equal(malformed.policy.outcome, "fail");
  assert.ok(malformed.findings.some((item) => item.code === "invalid_grounding_decision"));
  assert.deepEqual(validateIntegrationValue("assurance", malformed), []);
});

test("broken references fail in advisory and enforced modes", async (context) => {
  const project = await createProject(context);
  await writeFeature(project, {
    status: "required",
    concepts: ["sales.missing"]
  });

  for (const mode of ["advisory", "enforced"]) {
    const result = await assureGrounding("feature.md", { cwd: project, mode });
    assert.equal(result.preparation.state, "invalid");
    assert.equal(result.policy.outcome, "fail");
    assert.ok(result.findings.some((item) => item.code === "broken_domain_reference"));
  }
});

test("assure CLI returns policy-aware exit codes and deterministic JSON", async (context) => {
  const project = await createProject(context);
  await writeFeature(project, {
    status: "unclassified",
    concepts: ["sales.order"]
  });

  const advisoryOutput = memoryStream();
  const advisoryExit = await runCli(["assure", "feature.md", "--json"], {
    cwd: project,
    stdout: advisoryOutput,
    stderr: memoryStream()
  });
  const advisory = JSON.parse(advisoryOutput.toString());
  assert.equal(advisoryExit, 0);
  assert.equal(advisory.policy.outcome, "warn");

  const enforcedOutput = memoryStream();
  const enforcedExit = await runCli([
    "assure",
    "--mode",
    "enforced",
    "feature.md",
    "--json"
  ], {
    cwd: project,
    stdout: enforcedOutput,
    stderr: memoryStream()
  });
  const enforced = JSON.parse(enforcedOutput.toString());
  assert.equal(enforcedExit, 1);
  assert.equal(enforced.policy.outcome, "fail");

  const invalidOutput = memoryStream();
  const invalidExit = await runCli([
    "assure",
    "--mode",
    "optional",
    "feature.md",
    "--json"
  ], {
    cwd: project,
    stdout: invalidOutput,
    stderr: memoryStream()
  });
  const invalid = JSON.parse(invalidOutput.toString());
  assert.equal(invalidExit, 1);
  assert.equal(invalid.preparation.state, "invalid");
  assert.ok(invalid.findings.some((item) => item.code === "invalid_cli_input"));
});

test("Profile v1 remains readable but Assurance keeps it unclassified", async () => {
  const advisory = await assureGrounding(
    "external-features/order-cancellation.yaml",
    {
      cwd: ERP_ROOT,
      profile: "structured-feature",
      mode: "advisory",
      now: TEST_NOW
    }
  );
  const enforced = await assureGrounding(
    "external-features/order-cancellation.yaml",
    {
      cwd: ERP_ROOT,
      profile: "structured-feature",
      mode: "enforced",
      now: TEST_NOW
    }
  );

  assert.equal(advisory.grounding.status, "unclassified");
  assert.equal(advisory.preparation.state, "incomplete");
  assert.equal(advisory.policy.outcome, "warn");
  assert.ok(advisory.preparation.accepted_ids.includes("sales.order"));
  assert.ok(advisory.findings.some((item) => item.code === "legacy_grounding_status_missing"));
  assert.equal(enforced.policy.outcome, "fail");
});

async function createProject(context) {
  const project = await mkdtemp(path.join(os.tmpdir(), "opendomain-assurance-"));
  context.after(() => rm(project, { recursive: true, force: true }));
  await cp(path.join(ERP_ROOT, "opendomain"), path.join(project, "opendomain"), {
    recursive: true
  });
  return project;
}

async function writeFeature(project, options) {
  const grounding = options.omitGrounding
    ? ""
    : `grounding:\n  status: ${options.status}${options.rationale ? `\n  rationale: ${options.rationale}` : ""}\n`;
  const concepts = options.concepts?.length
    ? `\n${options.concepts.map((id) => `    - ${id}`).join("\n")}`
    : " []";

  await writeFile(path.join(project, "feature.md"), `---
type: feature_spec
id: spec.assurance-test
name: Assurance test
status: proposed
${grounding}affects_domain:
  concepts:${concepts}
  rules: []
  lifecycles: []
  events: []
---

# Assurance test
`, "utf8");
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
