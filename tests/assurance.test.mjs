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
import { validatePath } from "../src/validator.mjs";

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
  assert.ok(readFirstIds(result).includes("sales.order"));
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

test("externally constructed packs require accepted evidence for every affected ID", () => {
  const missingEvidence = evaluateGroundingPack(externalGroundingPack());

  assert.equal(missingEvidence.preparation.state, "invalid");
  assert.equal(missingEvidence.policy.outcome, "fail");
  assert.deepEqual(readFirstIds(missingEvidence), []);
  assert.ok(missingEvidence.findings.some((item) => (
    item.code === "unresolved_grounding_evidence"
    && item.problem.includes("sales.order")
  )));
  assert.deepEqual(validateIntegrationValue("assurance", missingEvidence), []);

  const resolvedEvidence = evaluateGroundingPack(externalGroundingPack({
    readFirst: [{
      id: "sales.order",
      type: "domain_concept",
      name: "Order",
      status: "accepted",
      file: "opendomain/concepts/sales.order.md",
      context: "sales"
    }]
  }));

  assert.equal(resolvedEvidence.preparation.state, "prepared");
  assert.equal(resolvedEvidence.policy.outcome, "pass");
  assert.deepEqual(readFirstIds(resolvedEvidence), ["sales.order"]);
  assert.deepEqual(validateIntegrationValue("assurance", resolvedEvidence), []);

  const forgedSummary = {
    ...resolvedEvidence,
    preparation: {
      ...resolvedEvidence.preparation,
      accepted_ids: ["sales.fake"]
    }
  };
  assert.ok(validateIntegrationValue("assurance", forgedSummary).length > 0);
});

test("external accepted evidence must match the affected domain category", () => {
  const result = evaluateGroundingPack(externalGroundingPack({
    affectedConcepts: [],
    affectedRules: ["sales.order"],
    readFirst: [{
      id: "sales.order",
      type: "domain_concept",
      name: "Order",
      status: "accepted",
      file: "opendomain/concepts/sales.order.md",
      context: "sales"
    }]
  }));

  assert.equal(result.preparation.state, "invalid");
  assert.equal(result.policy.outcome, "fail");
  assert.ok(result.findings.some((item) => (
    item.code === "domain_reference_type_mismatch"
    && item.field === "affects_domain.rules[0]"
  )));
  assert.deepEqual(validateIntegrationValue("assurance", result), []);
});

test("external packs reject duplicate evidence IDs with conflicting types", () => {
  const result = evaluateGroundingPack(externalGroundingPack({
    affectedConcepts: ["sales.order"],
    affectedRules: ["sales.order"],
    readFirst: [
      {
        id: "sales.order",
        type: "domain_concept",
        status: "accepted",
        file: "opendomain/concepts/sales.order.md"
      },
      {
        id: "sales.order",
        type: "business_rule",
        status: "accepted",
        file: "opendomain/rules/fake-sales.order.md"
      }
    ]
  }));

  assert.equal(result.preparation.state, "invalid");
  assert.equal(result.policy.outcome, "fail");
  assert.ok(result.findings.some((item) => (
    item.code === "invalid_grounding_pack"
    && item.field === "read_first[1].id"
  )));
  assert.deepEqual(validateIntegrationValue("assurance", result), []);
});

test("external Candidates cannot masquerade as accepted read-first evidence", () => {
  const result = evaluateGroundingPack(externalGroundingPack({
    readFirst: [
      {
        id: "sales.order",
        type: "domain_concept",
        status: "accepted",
        file: "opendomain/concepts/sales.order.md"
      },
      {
        id: "candidate-0001-order-lifecycle",
        type: "domain_candidate",
        status: "accepted",
        file: "opendomain/candidates/candidate-0001-order-lifecycle.md"
      }
    ]
  }));

  assert.equal(result.preparation.state, "invalid");
  assert.equal(result.policy.outcome, "fail");
  assert.deepEqual(readFirstIds(result), []);
  assert.ok(result.findings.some((item) => item.code === "invalid_grounding_pack"));
  assert.deepEqual(validateIntegrationValue("assurance", result), []);
});

test("external packs reject whitespace-only evidence paths", () => {
  const result = evaluateGroundingPack(externalGroundingPack({
    readFirst: [{
      id: "sales.order",
      type: "domain_concept",
      status: "accepted",
      file: "   "
    }]
  }));

  assert.equal(result.preparation.state, "invalid");
  assert.equal(result.policy.outcome, "fail");
  assert.deepEqual(readFirstIds(result), []);
  assert.ok(result.findings.some((item) => (
    item.code === "invalid_grounding_pack"
    && item.field === "read_first[0].file"
  )));
  assert.deepEqual(validateIntegrationValue("assurance", result), []);
});

test("external packs cannot match whitespace-only evidence IDs", () => {
  const result = evaluateGroundingPack(externalGroundingPack({
    affectedConcepts: ["   "],
    readFirst: [{
      id: "   ",
      type: "domain_concept",
      status: "accepted",
      file: "opendomain/concepts/blank.md"
    }]
  }));

  assert.equal(result.preparation.state, "invalid");
  assert.equal(result.policy.outcome, "fail");
  assert.ok(result.findings.some((item) => item.code === "invalid_grounding_pack"));
  assert.deepEqual(validateIntegrationValue("assurance", result), []);
});

test("external pack diagnostic arrays enforce their declared severity", () => {
  for (const [collection, severity] of [
    ["errors", "warning"],
    ["warnings", "error"]
  ]) {
    const pack = externalGroundingPack({ status: "unclassified" });
    pack[collection].push({
      severity,
      file: "feature.md",
      field: "$",
      problem: "Diagnostic is in the wrong collection.",
      fix: "Move it to the matching diagnostic collection."
    });

    const result = evaluateGroundingPack(pack);
    assert.equal(result.preparation.state, "invalid");
    assert.equal(result.policy.outcome, "fail");
    assert.deepEqual(validateIntegrationValue("assurance", result), []);
  }
});

test("externally constructed packs reject missing and unsupported grounding statuses", () => {
  for (const pack of [
    externalGroundingPack({ status: undefined }),
    externalGroundingPack({ status: "sometimes" }),
    externalGroundingPack({ omitGrounding: true })
  ]) {
    const result = evaluateGroundingPack(pack);

    assert.equal(result.grounding.status, null);
    assert.equal(result.preparation.state, "invalid");
    assert.equal(result.policy.outcome, "fail");
    assert.equal(result.grounding_request, null);
    assert.equal(result.grounding_pack.grounding_request, null);
    assert.ok(result.findings.some((item) => item.code === "invalid_grounding_decision"));
    assert.deepEqual(validateIntegrationValue("assurance", result), []);
  }
});

test("malformed external pack paths cannot invalidate Assurance diagnostics", () => {
  const result = evaluateGroundingPack(externalGroundingPack({
    status: "sometimes",
    sourcePath: { untrusted: true },
    featureFile: { untrusted: true }
  }));

  assert.equal(result.preparation.state, "invalid");
  assert.equal(result.policy.outcome, "fail");
  assert.ok(result.findings.length > 0);
  assert.ok(result.findings.every((item) => item.file === "<input>"));
  assert.deepEqual(validateIntegrationValue("assurance", result), []);
});

test("external not_required rationale must contain non-whitespace text", () => {
  const result = evaluateGroundingPack(externalGroundingPack({
    status: "not_required",
    rationale: "   ",
    affectedConcepts: []
  }));

  assert.equal(result.preparation.state, "invalid");
  assert.equal(result.policy.outcome, "fail");
  assert.ok(result.findings.some((item) => item.code === "invalid_grounding_decision"));
  assert.deepEqual(validateIntegrationValue("assurance", result), []);
});

test("external not_required packs cannot carry grounding evidence", () => {
  const result = evaluateGroundingPack(externalGroundingPack({
    status: "not_required",
    rationale: "No domain semantics are affected.",
    affectedConcepts: [],
    readFirst: [{
      id: "sales.order",
      type: "domain_concept",
      status: "accepted",
      file: "opendomain/concepts/sales.order.md"
    }]
  }));

  assert.equal(result.preparation.state, "invalid");
  assert.equal(result.policy.outcome, "fail");
  assert.ok(result.findings.some((item) => item.code === "invalid_grounding_pack"));
  assert.deepEqual(validateIntegrationValue("assurance", result), []);
});

test("external diagnostic codes are sanitized before Assurance output", () => {
  const pack = externalGroundingPack({ status: "unclassified" });
  pack.warnings.push({
    code: "INVALID-CODE",
    severity: "warning",
    file: "feature.md",
    field: "$",
    problem: "External warning.",
    fix: "Review the external warning."
  });

  const result = evaluateGroundingPack(pack);

  assert.equal(result.preparation.state, "incomplete");
  assert.equal(result.policy.outcome, "warn");
  assert.ok(result.findings.some((item) => item.code === "grounding_preparation_warning"));
  assert.ok(result.findings.every((item) => item.code !== "INVALID-CODE"));
  assert.deepEqual(validateIntegrationValue("assurance", result), []);
});

test("Assurance Result schema enforces policy outcomes for incomplete states", () => {
  const advisory = evaluateGroundingPack(externalGroundingPack({
    status: "unclassified"
  }));
  const enforced = evaluateGroundingPack(externalGroundingPack({
    status: "unclassified"
  }), { mode: "enforced" });

  assert.equal(advisory.policy.outcome, "warn");
  assert.equal(enforced.policy.outcome, "fail");
  assert.deepEqual(validateIntegrationValue("assurance", advisory), []);
  assert.deepEqual(validateIntegrationValue("assurance", enforced), []);

  for (const result of [advisory, enforced]) {
    const inconsistent = {
      ...result,
      policy: {
        ...result.policy,
        outcome: "pass"
      }
    };
    assert.ok(validateIntegrationValue("assurance", inconsistent).length > 0);
  }
});

test("Assurance Result schema binds preparation states to grounding statuses", () => {
  const incomplete = evaluateGroundingPack(externalGroundingPack({
    status: "unclassified",
    readFirst: [{
      id: "sales.order",
      type: "domain_concept",
      status: "accepted",
      file: "opendomain/concepts/sales.order.md"
    }]
  }));
  assert.equal(incomplete.preparation.state, "incomplete");
  assert.deepEqual(readFirstIds(incomplete), ["sales.order"]);

  const forgedPrepared = {
    ...incomplete,
    preparation: {
      ...incomplete.preparation,
      state: "prepared"
    },
    policy: {
      ...incomplete.policy,
      outcome: "pass"
    }
  };
  assert.ok(validateIntegrationValue("assurance", forgedPrepared).length > 0);

  const notRequired = evaluateGroundingPack(externalGroundingPack({
    status: "not_required",
    rationale: "No domain semantics are affected.",
    affectedConcepts: []
  }));
  assert.equal(notRequired.preparation.state, "not_required");
  assert.deepEqual(validateIntegrationValue("assurance", notRequired), []);

  const forgedSkip = {
    ...notRequired,
    grounding: {
      ...notRequired.grounding,
      status: "required"
    }
  };
  assert.ok(validateIntegrationValue("assurance", forgedSkip).length > 0);
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
  assert.deepEqual(readFirstIds(brokenContradiction), []);
});

test("prepared workspace evidence must match the affected domain category", async (context) => {
  const project = await createProject(context);
  await writeFeature(project, {
    status: "required",
    concepts: [],
    rules: ["sales.order"]
  });

  const pack = await prepareGroundingPack("feature.md", { cwd: project });
  assert.ok(pack.errors.some((item) => (
    item.code === "domain_reference_type_mismatch"
    && item.field === "affects_domain.rules[0]"
  )));
  assert.equal(pack.read_first.some((item) => item.id === "sales.order"), false);

  const result = await assureGrounding("feature.md", { cwd: project });
  assert.equal(result.preparation.state, "invalid");
  assert.equal(result.policy.outcome, "fail");
  assert.ok(result.findings.some((item) => item.code === "domain_reference_type_mismatch"));
  assert.deepEqual(validateIntegrationValue("assurance", result), []);
});

test("unknown affected-domain categories fail across validation entrypoints", async (context) => {
  const project = await createProject(context);
  await writeFile(path.join(project, "feature.md"), `---
type: feature_spec
id: spec.unknown-category
name: Unknown category
status: proposed
grounding:
  status: not_required
  rationale: This malformed declaration must not be ignored.
affects_domain:
  concepts: []
  rules: []
  lifecycles: []
  events: []
  rule:
    - sales.order
---
`, "utf8");

  const request = await buildGroundingRequest("feature.md", { cwd: project });
  const validation = await validatePath("feature.md", { cwd: project });
  const result = await assureGrounding("feature.md", { cwd: project });

  assert.ok(request.errors.some((item) => item.code === "invalid_affects_domain"));
  assert.ok(validation.errors.some((item) => item.code === "invalid_affects_domain"));
  assert.equal(result.preparation.state, "invalid");
  assert.equal(result.policy.outcome, "fail");
  assert.ok(result.findings.some((item) => item.code === "invalid_affects_domain"));
});

test("recognized malformed OpenSpec cannot fall through to a matching Profile", async (context) => {
  const project = await createProject(context);
  await writeFile(
    path.join(project, "opendomain/integrations/profiles/markdown-feature.yaml"),
    `schema_version: "1.0"
id: markdown-feature
source_type: feature-spec
source_unit:
  kind: file
  match:
    paths:
      - feature.md
intent:
  id:
    from: primary.id
  name:
    from: primary.name
  status:
    from: primary.status
references:
  mode: native
  affects_domain:
    concepts:
      from: primary.affects_domain.concepts
`,
    "utf8"
  );
  await writeFeature(project, {
    status: "sometimes",
    concepts: ["sales.order"]
  });

  const request = await buildGroundingRequest("feature.md", { cwd: project });
  const result = await assureGrounding("feature.md", { cwd: project });

  assert.equal(request.request, null);
  assert.ok(request.errors.some((item) => item.code === "invalid_grounding_decision"));
  assert.equal(result.preparation.state, "invalid");
  assert.equal(result.policy.outcome, "fail");
  assert.ok(result.findings.some((item) => item.code === "invalid_grounding_decision"));
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
  assert.ok(readFirstIds(advisory).includes("sales.order"));
  assert.equal(enforced.preparation.state, "incomplete");
  assert.equal(enforced.policy.outcome, "fail");
  assert.ok(readFirstIds(enforced).includes("sales.order"));
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
  assert.deepEqual(readFirstIds(result), []);
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
  assert.ok(readFirstIds(advisory).includes("sales.order"));
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

function readFirstIds(result) {
  return result.grounding_pack.read_first.map((item) => item.id);
}

async function writeFeature(project, options) {
  const grounding = options.omitGrounding
    ? ""
    : `grounding:\n  status: ${options.status}${options.rationale ? `\n  rationale: ${options.rationale}` : ""}\n`;
  const concepts = options.concepts?.length
    ? `\n${options.concepts.map((id) => `    - ${id}`).join("\n")}`
    : " []";
  const rules = options.rules?.length
    ? `\n${options.rules.map((id) => `    - ${id}`).join("\n")}`
    : " []";

  await writeFile(path.join(project, "feature.md"), `---
type: feature_spec
id: spec.assurance-test
name: Assurance test
status: proposed
${grounding}affects_domain:
  concepts:${concepts}
  rules:${rules}
  lifecycles: []
  events: []
---

# Assurance test
`, "utf8");
}

function externalGroundingPack(options = {}) {
  const pack = emptyGroundingPack({
    input: "feature.md",
    errors: []
  });
  const grounding = {};
  if (options.status !== undefined) {
    grounding.status = options.status;
  } else if (!("status" in options)) {
    grounding.status = "required";
  }
  if (options.rationale !== undefined) {
    grounding.rationale = options.rationale;
  }

  pack.feature = {
    id: "spec.external-pack",
    name: "External pack",
    file: options.featureFile ?? "feature.md"
  };
  pack.grounding_request = {
    protocol_version: "1.0",
    source: {
      type: "openspec",
      path: options.sourcePath ?? "feature.md"
    },
    intent: {
      id: "spec.external-pack",
      name: "External pack",
      status: "proposed"
    },
    grounding,
    affects_domain: {
      concepts: options.affectedConcepts ?? ["sales.order"],
      rules: options.affectedRules ?? [],
      lifecycles: [],
      events: []
    }
  };
  if (options.omitGrounding) {
    delete pack.grounding_request.grounding;
  }
  pack.read_first = options.readFirst ?? [];
  return pack;
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
