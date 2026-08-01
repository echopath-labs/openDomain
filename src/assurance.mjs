import { collectAffectedIds } from "./grounding-request.mjs";
import { validateIntegrationValue } from "./integration-schema-validator.mjs";
import {
  emptyGroundingPack,
  prepareGroundingPack
} from "./prepare.mjs";

export const ASSURANCE_VERSION = "1.0";

const POLICY_MODES = new Set(["advisory", "enforced"]);

export async function assureGrounding(inputPath, options = {}) {
  const mode = options.mode ?? "advisory";
  assertPolicyMode(mode);

  const pack = await prepareGroundingPack(inputPath, options);
  return evaluateGroundingPack(pack, { mode });
}

export function evaluateGroundingPack(inputPack, options = {}) {
  const mode = options.mode ?? "advisory";
  assertPolicyMode(mode);

  const pack = normalizeGroundingPack(inputPack);
  const request = pack.grounding_request;
  const grounding = normalizeGrounding(request, pack);
  const findings = [
    ...pack.errors.map((item) => toFinding(item, "error")),
    ...pack.warnings.map((item) => toFinding(item, "warning")),
    ...grounding.findings
  ];
  const affectedIds = request ? collectAffectedIds(request.affects_domain) : [];
  let state = "invalid";

  if (pack.errors.length === 0 && grounding.status !== null) {
    if (grounding.status === "not_required") {
      if (!grounding.rationale) {
        findings.push(finding({
          code: "grounding_rationale_required",
          severity: "error",
          file: request.source.path,
          field: "grounding.rationale",
          problem: "Grounding marked not_required must include a non-empty rationale.",
          fix: "Explain why this Source Unit does not require domain grounding."
        }));
      } else {
        state = "not_required";
      }
    } else if (grounding.status === "required") {
      if (affectedIds.length === 0) {
        state = "incomplete";
        findings.push(incompleteFinding(mode, {
          code: "domain_model_gap",
          file: request.source.path,
          field: "affects_domain",
          problem: "Grounding is required, but no accepted OpenDomain IDs are declared.",
          fix: "Investigate the domain and propose Domain Candidates before enforcing this request."
        }));
      } else {
        const unresolved = unresolvedAffectedIds(affectedIds, pack.read_first);
        if (unresolved.length > 0) {
          findings.push(finding({
            code: "unresolved_grounding_evidence",
            severity: "error",
            file: request.source.path,
            field: unresolved[0].field,
            problem: `Grounding is required, but accepted evidence was not resolved for: ${unresolved.map((item) => item.id).join(", ")}.`,
            fix: "Rebuild the Grounding Pack and ensure every declared affects_domain ID resolves to accepted OpenDomain knowledge."
          }));
        } else {
          state = "prepared";
        }
      }
    } else if (grounding.status === "unclassified") {
      state = "incomplete";
      findings.push(incompleteFinding(mode, {
        code: "grounding_unclassified",
        file: request.source.path,
        field: "grounding.status",
        problem: "The Grounding Request has not been classified as required or not_required.",
        fix: "Have Codex assess the domain impact and record an explicit grounding decision for human review."
      }));
    } else {
      findings.push(finding({
        code: "invalid_grounding_decision",
        severity: "error",
        file: request.source.path,
        field: "grounding.status",
        problem: "Grounding Request contains an unsupported grounding status.",
        fix: "Use required, not_required, or unclassified."
      }));
    }
  }

  const normalizedFindings = uniqueFindings(findings).sort(compareFindings);
  const hasErrors = normalizedFindings.some((item) => item.severity === "error");
  const hasWarnings = normalizedFindings.some((item) => item.severity === "warning");
  const outcome = state === "invalid" || hasErrors || (state === "incomplete" && mode === "enforced")
    ? "fail"
    : hasWarnings || state === "incomplete"
      ? "warn"
      : "pass";

  return {
    assurance_version: ASSURANCE_VERSION,
    grounding_request: request,
    grounding: {
      status: grounding.status,
      ...(grounding.rationale ? { rationale: grounding.rationale } : {})
    },
    preparation: {
      state,
      accepted_ids: uniqueIds(pack.read_first),
      candidate_ids: uniqueIds(pack.candidate_boundaries)
    },
    policy: {
      mode,
      outcome
    },
    findings: normalizedFindings,
    grounding_pack: pack
  };
}

function normalizeGroundingPack(pack) {
  const issues = validateIntegrationValue("pack", pack);
  if (issues.length === 0) {
    return pack;
  }

  const request = pack?.grounding_request;
  const affectedIds = collectAffectedIds(request?.affects_domain);
  const contradictorySkip = (
    request?.grounding?.status === "not_required"
    && affectedIds.length > 0
  );
  const input = request?.source?.path ?? pack?.feature?.file ?? "<input>";
  const errors = issues.map((item) => finding({
    ...item,
    code: packSchemaFindingCode(item.field, contradictorySkip),
    file: input,
    field: normalizePackIssueField(item.field)
  }));

  return emptyGroundingPack({ input, errors });
}

function packSchemaFindingCode(field, contradictorySkip) {
  if (contradictorySkip && field.includes("affects_domain")) {
    return "grounding_decision_contradiction";
  }
  if (field === "grounding_request.grounding" || field.startsWith("grounding_request.grounding.")) {
    return "invalid_grounding_decision";
  }
  return "invalid_grounding_pack";
}

function normalizePackIssueField(field) {
  return field.startsWith("grounding_request.")
    ? field.slice("grounding_request.".length)
    : field;
}

function unresolvedAffectedIds(affectedIds, readFirst) {
  const resolvedIds = new Set(
    readFirst
      .filter((item) => item?.status === "accepted")
      .map((item) => item.id)
  );
  const seen = new Set();
  return affectedIds.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }
    seen.add(item.id);
    return !resolvedIds.has(item.id);
  });
}

function uniqueIds(items) {
  return [...new Set(items.map((item) => item.id))];
}

export function invalidAssuranceResult(errors, options = {}) {
  const mode = options.mode ?? "advisory";
  assertPolicyMode(mode);
  return evaluateGroundingPack(emptyGroundingPack({
    input: options.input,
    errors: errors.map((item) => ({
      ...item,
      code: item.code ?? "invalid_cli_input"
    }))
  }), { mode });
}

export function formatAssuranceResult(result) {
  const lines = [
    "Grounding Assurance",
    "",
    `Version: ${result.assurance_version}`,
    `Grounding: ${result.grounding.status ?? "unavailable"}`,
    `Preparation: ${result.preparation.state}`,
    `Policy: ${result.policy.mode} -> ${result.policy.outcome}`,
    "",
    "Accepted grounding evidence:"
  ];

  if (result.grounding_pack.read_first.length === 0) {
    lines.push("- None");
  } else {
    for (const item of result.grounding_pack.read_first) {
      lines.push(`- ${item.id} -> ${item.file}`);
    }
  }

  lines.push("", "Candidate boundaries:");
  if (result.grounding_pack.candidate_boundaries.length === 0) {
    lines.push("- None");
  } else {
    for (const item of result.grounding_pack.candidate_boundaries) {
      lines.push(`- ${item.id} -> ${item.file} (proposed knowledge)`);
    }
  }

  lines.push("", "Findings:");
  if (result.findings.length === 0) {
    lines.push("- None");
  } else {
    for (const item of result.findings) {
      lines.push(`- [${item.severity}] ${item.code}: ${item.problem}`);
      lines.push(`  file: ${item.file}`);
      lines.push(`  field: ${item.field}`);
      lines.push(`  fix: ${item.fix}`);
    }
  }

  lines.push("", "Boundary:");
  lines.push("- This result evaluates current declarations and resolvable evidence; it does not prove Agent comprehension.");
  return `${lines.join("\n")}\n`;
}

function normalizeGrounding(request, pack) {
  if (!request) {
    return {
      status: null,
      rationale: null,
      findings: []
    };
  }

  if (!request.grounding) {
    const alreadyReported = pack.warnings.some((item) => item.code === "legacy_grounding_status_missing");
    return {
      status: "unclassified",
      rationale: null,
      findings: alreadyReported ? [] : [finding({
        code: "legacy_grounding_status_missing",
        severity: "warning",
        file: request.source.path,
        field: "grounding.status",
        problem: "Grounding Request has no explicit grounding status; it was normalized to 'unclassified'.",
        fix: "Upgrade the source integration to declare required, not_required, or unclassified."
      })]
    };
  }

  return {
    status: request.grounding.status,
    rationale: request.grounding.rationale ?? null,
    findings: []
  };
}

function incompleteFinding(mode, fields) {
  return finding({
    ...fields,
    severity: mode === "enforced" ? "error" : "warning"
  });
}

function toFinding(item, fallbackSeverity) {
  return finding({
    ...item,
    code: item.code ?? inferFindingCode(item, fallbackSeverity),
    severity: item.severity ?? fallbackSeverity
  });
}

function inferFindingCode(item, severity) {
  if (item.problem?.includes("Broken affects_domain reference")) {
    return "broken_domain_reference";
  }
  if (item.problem?.includes("non-accepted OpenDomain knowledge")) {
    return "non_accepted_domain_reference";
  }
  if (item.problem?.includes("Multiple integrations match")) {
    return "ambiguous_integration";
  }
  if (item.problem?.includes("schema")) {
    return "invalid_schema";
  }
  return severity === "error"
    ? "grounding_preparation_failed"
    : "grounding_preparation_warning";
}

function finding(fields) {
  return {
    code: fields.code,
    severity: fields.severity,
    file: fields.file ?? "<input>",
    field: fields.field ?? "$",
    problem: fields.problem,
    fix: fields.fix
  };
}

function uniqueFindings(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = [
      item.code,
      item.severity,
      item.file,
      item.field,
      item.problem,
      item.fix
    ].join("\0");
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function compareFindings(left, right) {
  return [left.severity, left.code, left.file, left.field]
    .join("\0")
    .localeCompare([right.severity, right.code, right.file, right.field].join("\0"));
}

function assertPolicyMode(mode) {
  if (!POLICY_MODES.has(mode)) {
    throw new RangeError(`Unsupported Assurance policy mode '${mode}'.`);
  }
}
