import { access, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { parseMarkdownFile } from "./frontmatter.mjs";
import { validatePath } from "./validator.mjs";

const AFFECTS_DOMAIN_FIELDS = ["concepts", "rules", "lifecycles", "events"];

export async function prepareGroundingPack(inputPath, options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const featureResult = await resolveFeatureSpec(inputPath, cwd);

  if (featureResult.errors.length > 0) {
    return emptyPack({
      input: inputPath,
      errors: featureResult.errors
    });
  }

  const corpus = await validatePath(undefined, { cwd, now: options.now ?? new Date() });
  const documentsById = new Map(corpus.documents.filter((document) => document.id).map((document) => [document.id, document]));
  const feature = featureResult.feature;
  const affectedIds = collectAffectedIds(feature.frontmatter.affects_domain);
  const readFirst = [];
  const errors = [...corpus.errors];
  const warnings = [...corpus.warnings];

  for (const affected of affectedIds) {
    const document = documentsById.get(affected.id);
    if (!document) {
      errors.push(issue({
        file: feature.file,
        field: affected.field,
        problem: `Broken affects_domain reference '${affected.id}'.`,
        fix: "Create the referenced OpenDomain object or correct the id."
      }));
      continue;
    }

    if (document.frontmatter.status !== "accepted") {
      errors.push(issue({
        file: feature.file,
        field: affected.field,
        problem: `Feature spec references non-accepted OpenDomain knowledge '${affected.id}'.`,
        fix: "Reference accepted OpenDomain knowledge, or keep uncertain knowledge in Candidate form."
      }));
      continue;
    }

    readFirst.push(toReadItem(document));
  }

  const readFirstIds = new Set(readFirst.map((item) => item.id));
  const candidateBoundaries = corpus.documents
    .filter((document) => document.type === "domain_candidate")
    .filter((document) => readFirstIds.has(document.frontmatter.target?.id))
    .map(toCandidateItem)
    .sort(compareById);

  const avoidedSemanticErrors = readFirst
    .filter((item) => item.type === "business_rule")
    .map((item) => ({
      id: item.id,
      source_file: item.file,
      summary: avoidedErrorSummary(item)
    }));

  return {
    feature: {
      id: feature.id,
      name: feature.frontmatter.name,
      file: feature.file
    },
    read_first: uniqueById(readFirst).sort(compareById),
    candidate_boundaries: candidateBoundaries,
    avoided_semantic_errors: avoidedSemanticErrors,
    errors,
    warnings
  };
}

export function formatGroundingPack(pack) {
  if (pack.errors.length > 0) {
    return formatPackIssues(pack);
  }

  const lines = [
    "Domain Grounding Pack",
    "",
    `Feature: ${pack.feature.id}`,
    `File: ${pack.feature.file}`,
    "",
    "Read first:"
  ];

  for (const item of pack.read_first) {
    lines.push(`- ${item.id} (${item.type}) -> ${item.file}`);
  }

  lines.push("", "Candidate boundaries:");
  if (pack.candidate_boundaries.length === 0) {
    lines.push("- None");
  } else {
    for (const item of pack.candidate_boundaries) {
      lines.push(`- ${item.id} -> ${item.file}`);
      lines.push(`  target: ${item.target_id}`);
      lines.push(`  status: ${item.status}`);
    }
  }

  lines.push("", "Avoided semantic errors:");
  if (pack.avoided_semantic_errors.length === 0) {
    lines.push("- None declared by affected accepted rules");
  } else {
    for (const item of pack.avoided_semantic_errors) {
      lines.push(`- ${item.summary}`);
    }
  }

  if (pack.warnings.length > 0) {
    lines.push("", "Warnings:");
    for (const warning of pack.warnings) {
      lines.push(`- ${warning.file} ${warning.field}: ${warning.problem}`);
    }
  }

  lines.push("", "Final response reminder:");
  lines.push("- Include 'Domain Grounding Used' with the accepted IDs read.");
  lines.push("- Report Candidate files as proposed knowledge, not accepted truth.");

  return `${lines.join("\n")}\n`;
}

function formatPackIssues(pack) {
  const lines = ["Domain Grounding Pack failed.", ""];
  for (const error of pack.errors) {
    lines.push(`[${error.severity}] ${error.file}`);
    lines.push(`  field: ${error.field}`);
    lines.push(`  problem: ${error.problem}`);
    lines.push(`  fix: ${error.fix}`);
  }
  return `${lines.join("\n")}\n`;
}

async function resolveFeatureSpec(inputPath, cwd) {
  if (!inputPath) {
    return {
      errors: [
        issue({
          file: "<input>",
          field: "$",
          problem: "Missing feature spec path.",
          fix: "Run opendomain prepare <feature-spec-or-dir>."
        })
      ]
    };
  }

  const absoluteInput = path.resolve(cwd, inputPath);
  if (!await exists(absoluteInput)) {
    return {
      errors: [
        issue({
          file: inputPath,
          field: "$",
          problem: "Feature spec path does not exist.",
          fix: "Pass an existing feature spec file or directory."
        })
      ]
    };
  }

  const files = (await stat(absoluteInput)).isDirectory()
    ? await walkMarkdown(absoluteInput)
    : [absoluteInput];

  const featureSpecs = [];
  const parseErrors = [];
  for (const file of files) {
    try {
      const parsed = await parseMarkdownFile(file);
      if (parsed.frontmatter.type === "feature_spec") {
        featureSpecs.push({
          file: path.relative(cwd, file) || path.basename(file),
          id: parsed.frontmatter.id,
          frontmatter: parsed.frontmatter,
          body: parsed.body
        });
      }
    } catch (error) {
      parseErrors.push(issue({
        file: path.relative(cwd, file) || file,
        field: error.field ?? "$",
        problem: error.problem ?? error.message,
        fix: "Use valid feature spec front matter."
      }));
    }
  }

  if (featureSpecs.length === 0) {
    return {
      errors: parseErrors.length > 0 ? parseErrors : [
        issue({
          file: inputPath,
          field: "type",
          problem: "No feature_spec found.",
          fix: "Pass a Markdown feature spec with type: feature_spec."
        })
      ]
    };
  }

  if (featureSpecs.length > 1) {
    return {
      errors: [
        issue({
          file: inputPath,
          field: "type",
          problem: "Multiple feature_spec files found.",
          fix: "Pass a single feature spec file for deterministic grounding."
        })
      ]
    };
  }

  const feature = featureSpecs[0];
  if (!feature.frontmatter.affects_domain || typeof feature.frontmatter.affects_domain !== "object") {
    return {
      errors: [
        issue({
          file: feature.file,
          field: "affects_domain",
          problem: "Feature spec is missing affects_domain.",
          fix: "Declare affected OpenDomain concepts, rules, lifecycles, or events."
        })
      ]
    };
  }

  return { feature, errors: [] };
}

function collectAffectedIds(affectsDomain) {
  const ids = [];
  for (const field of AFFECTS_DOMAIN_FIELDS) {
    const values = Array.isArray(affectsDomain[field]) ? affectsDomain[field] : [];
    values.forEach((id, index) => {
      ids.push({
        id,
        field: `affects_domain.${field}[${index}]`
      });
    });
  }
  return ids;
}

function toReadItem(document) {
  return {
    id: document.id,
    type: document.type,
    name: document.frontmatter.name,
    status: document.frontmatter.status,
    file: document.file,
    context: document.frontmatter.context
  };
}

function toCandidateItem(document) {
  return {
    id: document.id,
    status: document.frontmatter.status,
    target_id: document.frontmatter.target?.id,
    confidence: document.frontmatter.confidence,
    file: document.file
  };
}

function avoidedErrorSummary(item) {
  if (item.id === "sales.confirmed-order-cannot-be-deleted") {
    return "Do not add direct deletion behavior for confirmed orders; use cancellation semantics instead.";
  }
  return `Respect accepted business rule '${item.name ?? item.id}' while implementing this feature.`;
}

function uniqueById(items) {
  const seen = new Set();
  const unique = [];
  for (const item of items) {
    if (seen.has(item.id)) {
      continue;
    }
    seen.add(item.id);
    unique.push(item);
  }
  return unique;
}

function compareById(left, right) {
  return left.id.localeCompare(right.id);
}

function emptyPack({ input, errors }) {
  return {
    feature: {
      id: null,
      name: null,
      file: input ?? null
    },
    read_first: [],
    candidate_boundaries: [],
    avoided_semantic_errors: [],
    errors,
    warnings: []
  };
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

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function walkMarkdown(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walkMarkdown(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(fullPath);
    }
  }
  return files.sort();
}
