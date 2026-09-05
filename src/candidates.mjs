import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { parseMarkdown, serializeFrontmatter } from "./frontmatter.mjs";
import { validatePath } from "./validator.mjs";

const REVIEW_DECISIONS = new Set(["accepted", "rejected", "superseded", "deprecated"]);

export async function listCandidates(targetPath, options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const validation = await validatePath(targetPath, { cwd, now: options.now ?? new Date() });

  return {
    source: targetPath ?? "<default>",
    candidates: validation.documents
      .filter((document) => document.type === "domain_candidate")
      .map(toCandidateSummary)
      .sort(compareCandidates),
    warnings: validation.warnings,
    errors: validation.errors
  };
}

export async function showCandidate(candidateId, targetPath, options = {}) {
  const corpus = await listCandidateCorpus(candidateId, targetPath, options);
  if (corpus.errors.length > 0) {
    return {
      source: targetPath ?? "<default>",
      candidate: null,
      warnings: corpus.warnings,
      errors: corpus.errors
    };
  }

  return {
    source: targetPath ?? "<default>",
    candidate: toCandidateDetail(corpus.document),
    boundary: "Candidate is not accepted OpenDomain knowledge.",
    warnings: corpus.warnings,
    errors: []
  };
}

export async function reviewCandidate(candidateId, targetPath, reviewInput, options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const corpus = await listCandidateCorpus(candidateId, targetPath, options);
  const inputErrors = validateReviewInput(reviewInput);
  if (corpus.errors.length > 0 || inputErrors.length > 0) {
    return {
      candidate: null,
      decision: reviewInput.decision ?? null,
      effective_state: null,
      file: null,
      warnings: corpus.warnings,
      errors: [...corpus.errors, ...inputErrors]
    };
  }

  const document = corpus.document;
  const frontmatter = document.frontmatter;
  if (frontmatter.status !== "proposed" || frontmatter.review?.state !== "proposed") {
    return {
      candidate: toCandidateSummary(document),
      decision: reviewInput.decision,
      effective_state: frontmatter.status,
      file: document.file,
      warnings: corpus.warnings,
      errors: [
        issue({
          file: document.file,
          field: "status",
          problem: `Candidate '${candidateId}' already has final review state '${frontmatter.status}'.`,
          fix: "Review only proposed Candidates, or edit the Candidate manually with explicit rationale."
        })
      ]
    };
  }

  if (reviewInput.decision === "accepted" && frontmatter.approval) {
    return {
      candidate: toCandidateSummary(document),
      decision: reviewInput.decision,
      effective_state: frontmatter.status,
      file: document.file,
      warnings: corpus.warnings,
      errors: [issue({
        file: document.file,
        field: "approval",
        problem: `Candidate '${candidateId}' already has promotion approval.`,
        fix: "Prepare a promotion plan, or record a different final review decision with explicit rationale."
       })]
    };
  }

  const effectiveState = reviewInput.decision === "accepted" ? "proposed" : reviewInput.decision;
  const absoluteFile = path.resolve(cwd, document.file);
  const content = await readFile(absoluteFile, "utf8");
  const parsed = parseMarkdown(content, document.file);
  const decisionDate = reviewInput.reviewedAt ?? formatDate(options.now ?? new Date());
  const updatedFrontmatter = reviewInput.decision === "accepted"
    ? {
        ...parsed.frontmatter,
        status: "proposed",
        approval: {
          state: "approved_for_promotion",
          approved_by: reviewInput.reviewedBy,
          approved_at: decisionDate,
          decision_reason: normalizeLine(reviewInput.reason)
        },
        review: {
          ...parsed.frontmatter.review,
          state: "proposed"
        }
      }
    : {
        ...parsed.frontmatter,
        status: effectiveState,
        review: {
          ...parsed.frontmatter.review,
          state: effectiveState,
          reviewed_by: reviewInput.reviewedBy,
          reviewed_at: decisionDate,
          decision_reason: normalizeLine(reviewInput.reason)
        }
      };

  const nextContent = `---\n${serializeFrontmatter(updatedFrontmatter, document.file)}---\n${parsed.body}`;
  await writeFile(absoluteFile, nextContent, "utf8");

  const validation = await validatePath(targetPath, { cwd, now: options.now ?? new Date() });
  const candidate = validation.documents.find((item) => item.id === candidateId && item.type === "domain_candidate");
  return {
    candidate: candidate ? toCandidateSummary(candidate) : null,
    decision: reviewInput.decision,
    effective_state: effectiveState,
    file: document.file,
    promotion_required: reviewInput.decision === "accepted",
    boundary: reviewInput.decision === "accepted"
      ? "Promotion approval was recorded; the Candidate remains proposed and accepted domain knowledge files were not modified."
      : "Candidate review metadata was updated; accepted domain knowledge files were not modified.",
    warnings: validation.warnings,
    errors: validation.errors
  };
}

export async function planCandidatePromotion(candidateId, targetPath, promotionInput, options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const corpus = await listCandidateCorpus(candidateId, targetPath, options);
  const errors = [...corpus.errors];
  const document = corpus.document;

  if (!document) {
    return promotionPlanResult({ candidateId, targetPath, warnings: corpus.warnings, errors });
  }

  const frontmatter = document.frontmatter;
  const compatibilityRequired = requiresCompatibilityNote(frontmatter.proposed_change_type);
  if (frontmatter.status !== "proposed" || frontmatter.review?.state !== "proposed") {
    errors.push(issue({
      file: document.file,
      field: "status",
      problem: `Candidate '${candidateId}' is '${frontmatter.status}', not proposed.`,
      fix: "Prepare promotion only for an approved proposed Candidate."
    }));
  }
  if (frontmatter.approval?.state !== "approved_for_promotion") {
    errors.push(issue({
      file: document.file,
      field: "approval",
      problem: `Candidate '${candidateId}' has no promotion approval.`,
      fix: "Run candidate review with --decision accepted before preparing promotion."
    }));
  }
  if (!promotionInput.acceptedSource) {
    errors.push(issue({
      file: "<input>",
      field: "accepted_source",
      problem: "Missing accepted target source path.",
      fix: "Pass --accepted-source <file> for the human-reviewed accepted target."
    }));
  }
  if (compatibilityRequired && !promotionInput.compatibilityNote) {
    errors.push(issue({
      file: "<input>",
      field: "compatibility_note",
      problem: `Candidate operation '${frontmatter.proposed_change_type}' requires a compatibility note.`,
      fix: "Pass --compatibility-note <text> describing the accepted semantic impact."
    }));
  }

  const target = corpus.documents.find((item) => (
    item.id === frontmatter.target?.id && item.type === frontmatter.target?.type
  ));
  if (!target) {
    errors.push(issue({
      file: document.file,
      field: "target.id",
      problem: `Accepted target '${frontmatter.target?.id ?? ""}' with type '${frontmatter.target?.type ?? ""}' was not found.`,
      fix: "Create or select the human-reviewed target source before completing promotion."
    }));
  } else if (target.frontmatter.status !== "accepted" || target.frontmatter.review?.state !== "accepted") {
    errors.push(issue({
      file: target.file,
      field: "status",
      problem: `Promotion target '${target.id}' is not accepted human-reviewed knowledge.`,
      fix: "Add accepted review metadata and evidence to the target, then validate again."
    }));
  }

  let targetSummary = target ? {
    type: target.type,
    id: target.id,
    file: target.file,
    status: target.frontmatter.status,
    evidence: Array.isArray(target.frontmatter.evidence) ? target.frontmatter.evidence : [],
    review: target.frontmatter.review ?? null,
    source_hash: null
  } : null;

  if (target && promotionInput.acceptedSource) {
    const declaredFile = path.resolve(cwd, promotionInput.acceptedSource);
    const resolvedFile = path.resolve(cwd, target.file);
    if (declaredFile !== resolvedFile) {
      errors.push(issue({
        file: promotionInput.acceptedSource,
        field: "accepted_source",
        problem: `Accepted source does not resolve to Candidate target '${target.id}' at '${target.file}'.`,
        fix: `Pass --accepted-source ${target.file}.`
      }));
    } else {
      const content = await readFile(resolvedFile, "utf8");
      targetSummary = {
        ...targetSummary,
        source_hash: sha256(content)
      };
    }
  }

  return promotionPlanResult({
    candidateId,
    targetPath,
    candidate: toCandidatePromotionDescriptor(document),
    target: targetSummary,
    compatibilityNote: promotionInput.compatibilityNote,
    compatibilityRequired,
    warnings: corpus.warnings,
    errors
  });
}

export async function completeCandidatePromotion(candidateId, targetPath, completionInput, options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const corpus = await listCandidateCorpus(candidateId, targetPath, options);
  const document = corpus.document;
  const inputErrors = validateCompletionInput(completionInput);

  if (document?.frontmatter.promotion?.state === "completed" && document.frontmatter.status === "superseded") {
    return {
      plan: null,
      candidate: toCandidateSummary(document),
      file: document.file,
      already_completed: true,
      boundary: "Promotion was already completed; accepted domain knowledge files were not modified.",
      warnings: corpus.warnings,
      errors: inputErrors
    };
  }

  if (inputErrors.length > 0) {
    return {
      plan: null,
      candidate: document ? toCandidateSummary(document) : null,
      file: document?.file ?? null,
      already_completed: false,
      warnings: corpus.warnings,
      errors: [...corpus.errors, ...inputErrors]
    };
  }

  const plan = await planCandidatePromotion(candidateId, targetPath, completionInput, options);
  if (plan.errors.length > 0) {
    return {
      plan,
      candidate: plan.candidate,
      file: plan.candidate?.file ?? null,
      already_completed: false,
      warnings: plan.warnings,
      errors: plan.errors
    };
  }

  const content = await readFile(path.resolve(cwd, document.file), "utf8");
  const parsed = parseMarkdown(content, document.file);
  const completionDate = completionInput.confirmedAt ?? formatDate(options.now ?? new Date());
  const updatedFrontmatter = {
    ...parsed.frontmatter,
    status: "superseded",
    promotion: {
      state: "completed",
      accepted_target: {
        type: plan.target.type,
        id: plan.target.id,
        file: plan.target.file,
        source_hash: plan.target.source_hash
      },
      completed_by: completionInput.confirmedBy,
      completed_at: completionDate,
      decision_reason: normalizeLine(completionInput.reason),
      ...(completionInput.compatibilityNote
        ? { compatibility_note: normalizeLine(completionInput.compatibilityNote) }
        : {})
    },
    review: {
      ...parsed.frontmatter.review,
      state: "superseded",
      reviewed_by: completionInput.confirmedBy,
      reviewed_at: completionDate,
      decision_reason: normalizeLine(completionInput.reason)
    }
  };

  const nextContent = `---\n${serializeFrontmatter(updatedFrontmatter, document.file)}---\n${parsed.body}`;
  await writeFile(path.resolve(cwd, document.file), nextContent, "utf8");
  const validation = await validatePath(targetPath, { cwd, now: options.now ?? new Date() });
  const candidate = validation.documents.find((item) => item.id === candidateId && item.type === "domain_candidate");

  return {
    plan,
    candidate: candidate ? toCandidateSummary(candidate) : null,
    file: document.file,
    already_completed: false,
    boundary: "Promotion completion updated only the Candidate; accepted domain knowledge files were not modified.",
    warnings: validation.warnings,
    errors: validation.errors
  };
}

function validateReviewInput(input) {
  const errors = [];
  if (!REVIEW_DECISIONS.has(input.decision)) {
    errors.push(issue({
      file: "<input>",
      field: "decision",
      problem: `Unsupported Candidate review decision '${input.decision ?? ""}'.`,
      fix: "Use --decision accepted, rejected, superseded, or deprecated."
    }));
  }
  if (!input.reviewedBy) {
    errors.push(issue({
      file: "<input>",
      field: "reviewed_by",
      problem: "Missing Candidate reviewer.",
      fix: "Pass --reviewed-by <name>."
    }));
  }
  if (!input.reason) {
    errors.push(issue({
      file: "<input>",
      field: "reason",
      problem: "Missing Candidate review reason.",
      fix: "Pass --reason <text> so future agents can audit the decision."
    }));
  }
  if (input.reviewedAt && !/^\d{4}-\d{2}-\d{2}$/.test(input.reviewedAt)) {
    errors.push(issue({
      file: "<input>",
      field: "reviewed_at",
      problem: `Invalid reviewed_at date '${input.reviewedAt}'.`,
      fix: "Use --reviewed-at YYYY-MM-DD."
    }));
  }
  return errors;
}

async function listCandidateCorpus(candidateId, targetPath, options) {
  const cwd = options.cwd ?? process.cwd();
  const validation = await validatePath(targetPath, { cwd, now: options.now ?? new Date() });
  if (validation.errors.length > 0) {
    return {
      document: null,
      warnings: validation.warnings,
      errors: validation.errors
    };
  }

  if (!candidateId) {
    return {
      document: null,
      warnings: validation.warnings,
      errors: [
        issue({
          file: "<input>",
          field: "candidate_id",
          problem: "Missing Candidate id.",
          fix: "Run opendomain candidate show <candidate-id> or opendomain candidate review <candidate-id>."
        })
      ]
    };
  }

  const matches = validation.documents.filter((item) => item.id === candidateId);
  const candidate = matches.find((item) => item.type === "domain_candidate");
  if (!candidate) {
    return {
      document: null,
      warnings: validation.warnings,
      errors: [
        issue({
          file: targetPath ?? "<default>",
          field: "candidate_id",
          problem: `Candidate '${candidateId}' was not found.`,
          fix: "Run opendomain candidate list to find available Candidate ids."
        })
      ]
    };
  }

  return {
    document: candidate,
    documents: validation.documents,
    warnings: validation.warnings,
    errors: []
  };
}

function toCandidateSummary(document) {
  const frontmatter = document.frontmatter;
  return {
    id: document.id,
    status: frontmatter.status,
    review_state: frontmatter.review?.state,
    proposed_change_type: frontmatter.proposed_change_type,
    target: frontmatter.target,
    confidence: frontmatter.confidence,
    suggested_reviewer: frontmatter.review?.suggested_reviewer,
    reviewed_by: frontmatter.review?.reviewed_by,
    reviewed_at: frontmatter.review?.reviewed_at,
    decision_reason: frontmatter.review?.decision_reason,
    approval: frontmatter.approval ?? null,
    promotion: frontmatter.promotion ?? null,
    file: document.file
  };
}

function toCandidateDetail(document) {
  const frontmatter = document.frontmatter;
  return {
    ...toCandidateSummary(document),
    extracted_by: frontmatter.extracted_by,
    extracted_at: frontmatter.extracted_at,
    evidence: Array.isArray(frontmatter.evidence) ? frontmatter.evidence : [],
    possible_conflicts: Array.isArray(frontmatter.possible_conflicts) ? frontmatter.possible_conflicts : [],
    body: document.body.trim()
  };
}

function toCandidatePromotionDescriptor(document) {
  return {
    ...toCandidateSummary(document),
    evidence: Array.isArray(document.frontmatter.evidence) ? document.frontmatter.evidence : [],
    review: document.frontmatter.review ?? null
  };
}

function compareCandidates(left, right) {
  return left.id.localeCompare(right.id);
}

function normalizeLine(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function requiresCompatibilityNote(changeType) {
  return String(changeType ?? "").startsWith("update_") || changeType === "deprecate_knowledge";
}

function validateCompletionInput(input) {
  const errors = [];
  if (!input.confirmedBy) {
    errors.push(issue({
      file: "<input>",
      field: "confirmed_by",
      problem: "Missing final human confirmer.",
      fix: "Pass --confirmed-by <name>."
    }));
  }
  if (!input.reason) {
    errors.push(issue({
      file: "<input>",
      field: "reason",
      problem: "Missing Promotion completion reason.",
      fix: "Pass --reason <text> describing the confirmed accepted result."
    }));
  }
  if (input.confirmedAt && !/^\d{4}-\d{2}-\d{2}$/.test(input.confirmedAt)) {
    errors.push(issue({
      file: "<input>",
      field: "confirmed_at",
      problem: `Invalid confirmed_at date '${input.confirmedAt}'.`,
      fix: "Use --confirmed-at YYYY-MM-DD."
    }));
  }
  return errors;
}

function promotionPlanResult({
  candidateId,
  targetPath,
  candidate = null,
  target = null,
  compatibilityNote = null,
  compatibilityRequired = false,
  warnings = [],
  errors = []
}) {
  return {
    schema_version: "opendomain.candidate-promotion-plan.v1",
    applies: false,
    status: errors.length > 0 ? "blocked" : "ready",
    source: targetPath ?? "<default>",
    candidate: candidate ?? { id: candidateId },
    target,
    compatibility_note: compatibilityNote ? normalizeLine(compatibilityNote) : null,
    compatibility_validation: {
      required: compatibilityRequired,
      provided: Boolean(compatibilityNote),
      status: compatibilityRequired && !compatibilityNote ? "fail" : "pass"
    },
    required_confirmation: errors.length > 0
      ? null
      : "A human must confirm the final accepted target before Candidate supersession.",
    warnings,
    errors
  };
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function issue(issueFields) {
  return {
    severity: issueFields.severity ?? "error",
    file: issueFields.file,
    field: issueFields.field,
    problem: issueFields.problem,
    fix: issueFields.fix
  };
}
