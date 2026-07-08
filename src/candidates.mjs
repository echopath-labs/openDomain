import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseMarkdown } from "./frontmatter.mjs";
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

  const effectiveState = reviewInput.decision === "accepted" ? "superseded" : reviewInput.decision;
  const absoluteFile = path.resolve(cwd, document.file);
  const content = await readFile(absoluteFile, "utf8");
  const parsed = parseMarkdown(content, document.file);
  const updatedFrontmatter = {
    ...parsed.frontmatter,
    status: effectiveState,
    review: {
      ...parsed.frontmatter.review,
      state: effectiveState,
      reviewed_by: reviewInput.reviewedBy,
      reviewed_at: reviewInput.reviewedAt ?? formatDate(options.now ?? new Date()),
      decision_reason: normalizeLine(reviewInput.reason)
    }
  };

  const nextContent = `---\n${serializeYaml(updatedFrontmatter)}---\n${parsed.body}`;
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
      ? "Accepted domain knowledge files were not modified automatically."
      : "Candidate review metadata was updated; accepted domain knowledge files were not modified.",
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

function compareCandidates(left, right) {
  return left.id.localeCompare(right.id);
}

function serializeYaml(value, indent = 0) {
  const space = " ".repeat(indent);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return `${space}${formatScalar(value)}\n`;
  }

  let output = "";
  for (const [key, child] of Object.entries(value)) {
    if (Array.isArray(child)) {
      if (child.length === 0) {
        output += `${space}${key}: []\n`;
      } else {
        output += `${space}${key}:\n${serializeArray(child, indent + 2)}`;
      }
      continue;
    }

    if (child && typeof child === "object") {
      output += `${space}${key}:\n${serializeYaml(child, indent + 2)}`;
      continue;
    }

    output += `${space}${key}: ${formatScalar(child)}\n`;
  }
  return output;
}

function serializeArray(values, indent) {
  const space = " ".repeat(indent);
  let output = "";
  for (const value of values) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const entries = Object.entries(value);
      if (entries.length === 0) {
        output += `${space}- {}\n`;
        continue;
      }
      const [firstKey, firstValue] = entries[0];
      if (firstValue && typeof firstValue === "object") {
        output += `${space}- ${firstKey}:\n${serializeYaml(firstValue, indent + 4)}`;
      } else {
        output += `${space}- ${firstKey}: ${formatScalar(firstValue)}\n`;
      }
      for (const [key, child] of entries.slice(1)) {
        if (Array.isArray(child)) {
          if (child.length === 0) {
            output += `${space}  ${key}: []\n`;
          } else {
            output += `${space}  ${key}:\n${serializeArray(child, indent + 4)}`;
          }
        } else if (child && typeof child === "object") {
          output += `${space}  ${key}:\n${serializeYaml(child, indent + 4)}`;
        } else {
          output += `${space}  ${key}: ${formatScalar(child)}\n`;
        }
      }
      continue;
    }

    output += `${space}- ${formatScalar(value)}\n`;
  }
  return output;
}

function formatScalar(value) {
  if (value === undefined || value === null) {
    return "null";
  }
  if (typeof value === "boolean" || typeof value === "number") {
    return String(value);
  }
  const normalized = normalizeLine(String(value));
  if (normalized === "") {
    return "\"\"";
  }
  if (/^(true|false|null|~|\[\]|-?\d+|-?\d+\.\d+)$/.test(normalized)) {
    return `"${normalized}"`;
  }
  return normalized;
}

function normalizeLine(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
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
