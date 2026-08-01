import { AFFECTS_DOMAIN_FIELDS } from "./domain-reference-types.mjs";

const GROUNDING_STATUSES = new Set(["required", "not_required", "unclassified"]);
const GROUNDING_FIELDS = new Set(["status", "rationale"]);

export function validateGroundingDecision(frontmatter, sourceFile) {
  const value = frontmatter.grounding;
  if (value === undefined) {
    return {
      grounding: { status: "unclassified" },
      errors: [],
      warnings: [issue({
        code: "legacy_grounding_status_missing",
        severity: "warning",
        file: sourceFile,
        field: "grounding.status",
        problem: "Feature spec has no explicit grounding status; it was normalized to 'unclassified'.",
        fix: "Declare grounding.status as required, not_required, or unclassified."
      })]
    };
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return invalidGroundingDecision(
      sourceFile,
      "grounding",
      "Feature spec grounding must be an object.",
      "Declare grounding.status and an optional grounding.rationale."
    );
  }

  const errors = [];
  for (const field of Object.keys(value)) {
    if (!GROUNDING_FIELDS.has(field)) {
      errors.push(issue({
        code: "invalid_grounding_decision",
        file: sourceFile,
        field: `grounding.${field}`,
        problem: `Unknown grounding field '${field}'.`,
        fix: "Use only grounding.status and grounding.rationale."
      }));
    }
  }

  if (typeof value.status !== "string" || !GROUNDING_STATUSES.has(value.status)) {
    errors.push(issue({
      code: "invalid_grounding_decision",
      file: sourceFile,
      field: "grounding.status",
      problem: "Feature spec grounding.status must be required, not_required, or unclassified.",
      fix: "Choose one supported grounding status explicitly."
    }));
  }

  const invalidRationale = (
    value.rationale !== undefined
    && (typeof value.rationale !== "string" || !value.rationale.trim())
  );
  if (invalidRationale) {
    errors.push(issue({
      code: "invalid_grounding_decision",
      file: sourceFile,
      field: "grounding.rationale",
      problem: "Feature spec grounding.rationale must be a non-empty string when provided.",
      fix: "Provide a concise rationale or remove the field."
    }));
  }

  if (
    value.status === "not_required"
    && !invalidRationale
    && (typeof value.rationale !== "string" || !value.rationale.trim())
  ) {
    errors.push(issue({
      code: "grounding_rationale_required",
      file: sourceFile,
      field: "grounding.rationale",
      problem: "Feature specs marked not_required must explain why domain grounding is unnecessary.",
      fix: "Add a non-empty grounding.rationale."
    }));
  }

  const affectedField = firstAffectedField(frontmatter.affects_domain);
  if (value.status === "not_required" && affectedField) {
    errors.push(issue({
      code: "grounding_decision_contradiction",
      file: sourceFile,
      field: affectedField,
      problem: "Grounding is marked not_required but affects_domain contains OpenDomain IDs.",
      fix: "Remove the IDs or change grounding.status to required or unclassified."
    }));
  }

  const grounding = { status: value.status };
  if (typeof value.rationale === "string" && value.rationale.trim()) {
    grounding.rationale = value.rationale.trim();
  }

  return {
    grounding,
    errors,
    warnings: []
  };
}

function firstAffectedField(affectsDomain) {
  for (const field of AFFECTS_DOMAIN_FIELDS) {
    if (Array.isArray(affectsDomain?.[field]) && affectsDomain[field].length > 0) {
      return `affects_domain.${field}[0]`;
    }
  }
  return null;
}

function invalidGroundingDecision(sourceFile, field, problem, fix) {
  return {
    grounding: null,
    errors: [issue({
      code: "invalid_grounding_decision",
      file: sourceFile,
      field,
      problem,
      fix
    })],
    warnings: []
  };
}

function issue(fields) {
  return {
    ...(fields.code ? { code: fields.code } : {}),
    severity: fields.severity ?? "error",
    file: fields.file,
    field: fields.field,
    problem: fields.problem,
    fix: fields.fix
  };
}
