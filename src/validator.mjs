import { access, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { parseMarkdownFile, FrontMatterError } from "./frontmatter.mjs";
import {
  createDomainSchemaRegistry,
  DOMAIN_SOURCE_TYPES,
  getDefaultDomainSchemaRegistry,
  validateDomainFrontmatter
} from "./schema-validator.mjs";

const DOMAIN_TYPES = new Set(DOMAIN_SOURCE_TYPES);

const KNOWN_TYPES = new Set([...DOMAIN_TYPES, "feature_spec"]);

const REVIEW_STATES = new Set(["proposed", "accepted", "rejected", "superseded", "deprecated"]);
const FINAL_CANDIDATE_STATES = new Set(["rejected", "superseded", "deprecated"]);

const REQUIRED_FIELDS = {
  bounded_context: ["type", "id", "name", "status", "review"],
  domain_concept: ["type", "id", "name", "context", "status", "review"],
  business_rule: ["type", "id", "name", "context", "status", "applies_to", "severity", "rule_type", "review"],
  lifecycle: ["type", "id", "name", "context", "status", "applies_to", "states", "transitions", "review"],
  domain_event: ["type", "id", "name", "context", "status", "occurs_when", "review"],
  domain_candidate: [
    "type",
    "id",
    "status",
    "proposed_change_type",
    "target",
    "confidence",
    "extracted_by",
    "extracted_at",
    "evidence",
    "review"
  ],
  feature_spec: ["type", "id", "name", "status", "affects_domain"]
};

const AFFECTS_DOMAIN_TYPES = {
  concepts: "domain_concept",
  rules: "business_rule",
  lifecycles: "lifecycle",
  events: "domain_event"
};

export async function validatePath(targetPath, options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const now = options.now ?? new Date();
  const result = {
    documents: [],
    errors: [],
    warnings: []
  };

  let schemaRegistry;
  try {
    schemaRegistry = resolveSchemaRegistry(options);
  } catch (error) {
    addSchemaRegistryIssue(result, error);
    return result;
  }

  const files = await collectMarkdownFiles(targetPath, cwd, result);
  for (const file of files) {
    try {
      const parsed = await parseMarkdownFile(file);
      const relativeFile = path.relative(cwd, file) || path.basename(file);
      const type = parsed.frontmatter.type;

      if (type === undefined || type === null || type === "") {
        addIssue(result.errors, {
          file: relativeFile,
          field: "type",
          problem: "Missing required field 'type'.",
          fix: "Set type to a supported OpenDomain object type."
        });
        continue;
      }

      if (!KNOWN_TYPES.has(type)) {
        addIssue(result.errors, {
          file: relativeFile,
          field: "type",
          problem: typeof type === "string"
            ? `Unsupported type '${type}'.`
            : `Field 'type' must be a supported string, received ${valueKind(type)}.`,
          fix: `Use one of: ${[...KNOWN_TYPES].sort().join(", ")}.`
        });
        continue;
      }

      if (DOMAIN_TYPES.has(type)) {
        let schemaIssues;
        try {
          schemaIssues = validateDomainFrontmatter(
            parsed.frontmatter,
            type,
            schemaRegistry
          );
        } catch (error) {
          result.documents = [];
          result.errors = [];
          result.warnings = [];
          addSchemaRegistryIssue(result, error);
          return result;
        }
        if (schemaIssues.length > 0) {
          for (const issue of schemaIssues) {
            addIssue(result.errors, { file: relativeFile, ...issue });
          }
          continue;
        }
      }

      result.documents.push({
        file: relativeFile,
        absoluteFile: file,
        type,
        id: parsed.frontmatter.id,
        frontmatter: parsed.frontmatter,
        body: parsed.body
      });
    } catch (error) {
      addIssue(result.errors, {
        file: path.relative(cwd, file) || file,
        field: error instanceof FrontMatterError ? error.field : "$",
        problem: error instanceof FrontMatterError ? error.problem : String(error.message ?? error),
        fix: "Add valid YAML front matter delimited by --- at the top of the Markdown file."
      });
    }
  }

  validateDocuments(result, now);
  deleteInternalPaths(result);
  return result;
}

function resolveSchemaRegistry(options) {
  if (options.schemaRegistry) {
    return options.schemaRegistry;
  }
  if (options.schemaDirectory) {
    return createDomainSchemaRegistry({ schemaDirectory: options.schemaDirectory });
  }
  return getDefaultDomainSchemaRegistry();
}

function addSchemaRegistryIssue(result, error) {
  addIssue(result.errors, {
    file: "schemas",
    field: "$",
    problem: `Runtime schema registry is unavailable: ${error.message}`,
    fix: "Restore or reinstall the packaged OpenDomain schemas before validating domain knowledge."
  });
}

async function collectMarkdownFiles(targetPath, cwd, result) {
  if (!targetPath) {
    const roots = ["domain", "examples"]
      .map((root) => path.join(cwd, root));
    const files = [];
    for (const root of roots) {
      if (await exists(root)) {
        files.push(...await walkMarkdown(root));
      }
    }
    return files;
  }

  const absoluteTarget = path.resolve(cwd, targetPath);
  if (!await exists(absoluteTarget)) {
    addIssue(result.errors, {
      file: targetPath,
      field: "$",
      problem: "Path does not exist.",
      fix: "Pass an existing OpenDomain file or directory."
    });
    return [];
  }

  const targetStat = await stat(absoluteTarget);
  if (targetStat.isFile()) {
    return absoluteTarget.endsWith(".md") ? [absoluteTarget] : [];
  }
  return walkMarkdown(absoluteTarget);
}

async function walkMarkdown(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === "node_modules" || entry.name === ".codex") {
      continue;
    }
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walkMarkdown(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".md") && entry.name !== "README.md") {
      files.push(fullPath);
    }
  }
  return files.sort();
}

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

function validateDocuments(result, now) {
  const byId = new Map();
  const domainById = new Map();

  for (const document of result.documents) {
    validateBaseShape(document, result);
    if (!document.id) {
      continue;
    }

    if (byId.has(document.id)) {
      addIssue(result.errors, {
        file: document.file,
        field: "id",
        problem: `Duplicate id '${document.id}' also appears in ${byId.get(document.id).file}.`,
        fix: "Use a globally unique stable id."
      });
    } else {
      byId.set(document.id, document);
    }

    if (DOMAIN_TYPES.has(document.type)) {
      domainById.set(document.id, document);
    }
  }

  for (const document of result.documents) {
    validateStatusAndReview(document, result);
    validateTypedReferences(document, domainById, result);
    validateLifecycle(document, result);
    validateFeatureSpec(document, domainById, result);
    validateCandidateStaleness(document, now, result);
  }
}

function validateBaseShape(document, result) {
  const frontmatter = document.frontmatter;

  if (!frontmatter.type) {
    addIssue(result.errors, {
      file: document.file,
      field: "type",
      problem: "Missing required field 'type'.",
      fix: "Set type to a supported OpenDomain object type."
    });
    return;
  }

  if (!KNOWN_TYPES.has(frontmatter.type)) {
    addIssue(result.errors, {
      file: document.file,
      field: "type",
      problem: `Unsupported type '${frontmatter.type}'.`,
      fix: `Use one of: ${[...KNOWN_TYPES].sort().join(", ")}.`
    });
    return;
  }

  const required = REQUIRED_FIELDS[frontmatter.type] ?? [];
  for (const field of required) {
    if (isMissing(frontmatter[field])) {
      addIssue(result.errors, {
        file: document.file,
        field,
        problem: `Missing required field '${field}'.`,
        fix: `Add '${field}' to the front matter.`
      });
    }
  }

  if (frontmatter.status && !REVIEW_STATES.has(frontmatter.status)) {
    addIssue(result.errors, {
      file: document.file,
      field: "status",
      problem: `Unsupported status '${frontmatter.status}'.`,
      fix: `Use one of: ${[...REVIEW_STATES].join(", ")}.`
    });
  }

  if (frontmatter.review?.state && !REVIEW_STATES.has(frontmatter.review.state)) {
    addIssue(result.errors, {
      file: document.file,
      field: "review.state",
      problem: `Unsupported review state '${frontmatter.review.state}'.`,
      fix: `Use one of: ${[...REVIEW_STATES].join(", ")}.`
    });
  }
}

function validateStatusAndReview(document, result) {
  const frontmatter = document.frontmatter;

  if (frontmatter.status === "accepted") {
    if (!Array.isArray(frontmatter.evidence) || frontmatter.evidence.length === 0) {
      addIssue(result.errors, {
        file: document.file,
        field: "evidence",
        problem: "Accepted knowledge must include evidence.",
        fix: "Add at least one evidence entry or move the knowledge back to proposed Candidate state."
      });
    }

    if (!frontmatter.review || frontmatter.review.state !== "accepted" || !frontmatter.review.reviewed_by || !frontmatter.review.reviewed_at) {
      addIssue(result.errors, {
        file: document.file,
        field: "review",
        problem: "Accepted knowledge must include accepted human review metadata.",
        fix: "Set review.state, review.reviewed_by, and review.reviewed_at after human approval."
      });
    }
  }

  if (frontmatter.type === "domain_candidate") {
    if (frontmatter.status === "accepted") {
      addIssue(result.errors, {
        file: document.file,
        field: "status",
        problem: "Candidates cannot be accepted knowledge directly.",
        fix: "Promote accepted content into the target OpenDomain file and mark the Candidate superseded or deprecated."
      });
    }

    if (!Array.isArray(frontmatter.evidence) || frontmatter.evidence.length === 0) {
      addIssue(result.errors, {
        file: document.file,
        field: "evidence",
        problem: "Candidate must include evidence.",
        fix: "Add evidence with type, location, summary, and confidence."
      });
    }

    if (!frontmatter.review?.suggested_reviewer) {
      addIssue(result.errors, {
        file: document.file,
        field: "review.suggested_reviewer",
        problem: "Candidate must suggest a human reviewer.",
        fix: "Set review.suggested_reviewer to the expected domain owner or maintainer."
      });
    }

    if (frontmatter.status && frontmatter.review?.state && frontmatter.status !== frontmatter.review.state) {
      addIssue(result.errors, {
        file: document.file,
        field: "review.state",
        problem: `Candidate status '${frontmatter.status}' does not match review state '${frontmatter.review.state}'.`,
        fix: "Keep Candidate status and review.state aligned."
      });
    }

    if (FINAL_CANDIDATE_STATES.has(frontmatter.status)) {
      if (!frontmatter.review?.reviewed_by || !frontmatter.review?.reviewed_at || !frontmatter.review?.decision_reason) {
        addIssue(result.errors, {
          file: document.file,
          field: "review",
          problem: "Final Candidate review decisions must include reviewer, date, and reason.",
          fix: "Set review.reviewed_by, review.reviewed_at, and review.decision_reason."
        });
      }
    }
  }
}

function validateTypedReferences(document, domainById, result) {
  const frontmatter = document.frontmatter;
  const requireReference = (id, field, expectedTypes = null) => {
    if (!id) {
      return;
    }
    const target = domainById.get(id);
    if (!target) {
      addIssue(result.errors, {
        file: document.file,
        field,
        problem: `Broken reference '${id}'.`,
        fix: "Create the referenced OpenDomain object or correct the id."
      });
      return;
    }
    if (expectedTypes && !expectedTypes.includes(target.type)) {
      addIssue(result.errors, {
        file: document.file,
        field,
        problem: `Reference '${id}' points to ${target.type}, expected ${expectedTypes.join(" or ")}.`,
        fix: "Reference an object of the expected type."
      });
    }
    if (frontmatter.status === "accepted" && target.frontmatter.status !== "accepted") {
      addIssue(result.errors, {
        file: document.file,
        field,
        problem: `Accepted knowledge cannot depend on non-accepted reference '${id}'.`,
        fix: "Accept the referenced knowledge through human review or move this object back to proposed state."
      });
    }
  };

  if (frontmatter.context) {
    requireReference(frontmatter.context, "context", ["bounded_context"]);
  }

  if (frontmatter.type === "domain_concept") {
    forEachArray(frontmatter.related, "related", (relationship, field) => {
      requireReference(relationship?.target, `${field}.target`, ["domain_concept"]);
      if (!relationship?.type) {
        addIssue(result.errors, {
          file: document.file,
          field: `${field}.type`,
          problem: "Relationship predicate is missing.",
          fix: "Use a precise predicate instead of an empty relationship."
        });
      }
    });
    forEachArray(frontmatter.rules, "rules", (id, field) => requireReference(id, field, ["business_rule"]));
    forEachArray(frontmatter.lifecycles, "lifecycles", (id, field) => requireReference(id, field, ["lifecycle"]));
    forEachArray(frontmatter.events, "events", (id, field) => requireReference(id, field, ["domain_event"]));
  }

  if (frontmatter.type === "business_rule") {
    forEachArray(frontmatter.applies_to, "applies_to", (id, field) => requireReference(id, field, ["domain_concept"]));
  }

  if (frontmatter.type === "lifecycle") {
    forEachArray(frontmatter.applies_to, "applies_to", (id, field) => requireReference(id, field, ["domain_concept"]));
    forEachArray(frontmatter.related_rules, "related_rules", (id, field) => requireReference(id, field, ["business_rule"]));
  }

  if (frontmatter.type === "domain_event") {
    forEachArray(frontmatter.applies_to, "applies_to", (id, field) => requireReference(id, field, ["domain_concept"]));
    forEachArray(frontmatter.related_lifecycle, "related_lifecycle", (id, field) => requireReference(id, field, ["lifecycle"]));
  }

  if (frontmatter.type === "domain_candidate" && frontmatter.target?.id) {
    const requiresExistingTarget = String(frontmatter.proposed_change_type ?? "").startsWith("update_")
      || frontmatter.proposed_change_type === "deprecate_knowledge";
    if (requiresExistingTarget) {
      requireReference(frontmatter.target.id, "target.id");
    }
  }
}

function validateLifecycle(document, result) {
  const frontmatter = document.frontmatter;
  if (frontmatter.type !== "lifecycle") {
    return;
  }

  const states = Array.isArray(frontmatter.states) ? frontmatter.states : [];
  const stateIds = new Set();
  const terminalStates = new Set();

  states.forEach((state, index) => {
    const field = `states[${index}]`;
    if (!state?.id) {
      addIssue(result.errors, {
        file: document.file,
        field: `${field}.id`,
        problem: "Lifecycle state is missing id.",
        fix: "Add a stable state id."
      });
      return;
    }
    if (stateIds.has(state.id)) {
      addIssue(result.errors, {
        file: document.file,
        field: `${field}.id`,
        problem: `Duplicate lifecycle state '${state.id}'.`,
        fix: "Use each lifecycle state id only once."
      });
    }
    stateIds.add(state.id);
    if (state.terminal === true) {
      terminalStates.add(state.id);
    }
  });

  forEachArray(frontmatter.transitions, "transitions", (transition, field) => {
    if (!stateIds.has(transition?.from)) {
      addIssue(result.errors, {
        file: document.file,
        field: `${field}.from`,
        problem: `Transition references missing source state '${transition?.from}'.`,
        fix: "Add the state or correct the transition source."
      });
    }
    if (!stateIds.has(transition?.to)) {
      addIssue(result.errors, {
        file: document.file,
        field: `${field}.to`,
        problem: `Transition references missing target state '${transition?.to}'.`,
        fix: "Add the state or correct the transition target."
      });
    }
    if (terminalStates.has(transition?.from)) {
      addIssue(result.errors, {
        file: document.file,
        field: `${field}.from`,
        problem: `Terminal state '${transition.from}' has an outgoing transition.`,
        fix: "Remove the transition or mark the state as non-terminal."
      });
    }
  });

  forEachArray(frontmatter.forbidden_transitions, "forbidden_transitions", (transition, field) => {
    if (!stateIds.has(transition?.from)) {
      addIssue(result.errors, {
        file: document.file,
        field: `${field}.from`,
        problem: `Forbidden transition references missing source state '${transition?.from}'.`,
        fix: "Add the state or correct the forbidden transition source."
      });
    }
    if (!stateIds.has(transition?.to)) {
      addIssue(result.errors, {
        file: document.file,
        field: `${field}.to`,
        problem: `Forbidden transition references missing target state '${transition?.to}'.`,
        fix: "Add the state or correct the forbidden transition target."
      });
    }
  });
}

function validateFeatureSpec(document, domainById, result) {
  const frontmatter = document.frontmatter;
  if (frontmatter.type !== "feature_spec") {
    return;
  }

  const affectsDomain = frontmatter.affects_domain;
  if (!affectsDomain || typeof affectsDomain !== "object") {
    addIssue(result.errors, {
      file: document.file,
      field: "affects_domain",
      problem: "Feature spec must declare affected OpenDomain IDs.",
      fix: "Add affects_domain.concepts, rules, lifecycles, or events."
    });
    return;
  }

  for (const [fieldName, expectedType] of Object.entries(AFFECTS_DOMAIN_TYPES)) {
    forEachArray(affectsDomain[fieldName], `affects_domain.${fieldName}`, (id, field) => {
      const target = domainById.get(id);
      if (!target) {
        addIssue(result.errors, {
          file: document.file,
          field,
          problem: `Broken affects_domain reference '${id}'.`,
          fix: "Create the referenced OpenDomain object or correct the id."
        });
        return;
      }
      if (target.type !== expectedType) {
        addIssue(result.errors, {
          file: document.file,
          field,
          problem: `Reference '${id}' points to ${target.type}, expected ${expectedType}.`,
          fix: `Move the id to the correct affects_domain section or reference a ${expectedType}.`
        });
      }
      if (target.frontmatter.status !== "accepted") {
        addIssue(result.errors, {
          file: document.file,
          field,
          problem: `Feature spec references non-accepted OpenDomain knowledge '${id}'.`,
          fix: "Reference accepted OpenDomain knowledge, or keep uncertain knowledge in Candidate form."
        });
      }
    });
  }
}

function validateCandidateStaleness(document, now, result) {
  const frontmatter = document.frontmatter;
  if (frontmatter.type !== "domain_candidate" || frontmatter.status !== "proposed" || !frontmatter.extracted_at) {
    return;
  }

  const extractedAt = new Date(`${frontmatter.extracted_at}T00:00:00Z`);
  if (Number.isNaN(extractedAt.getTime())) {
    addIssue(result.errors, {
      file: document.file,
      field: "extracted_at",
      problem: "Candidate extracted_at is not a valid date.",
      fix: "Use YYYY-MM-DD."
    });
    return;
  }

  const ageDays = Math.floor((now.getTime() - extractedAt.getTime()) / 86_400_000);
  if (ageDays > 30) {
    addIssue(result.warnings, {
      severity: "warning",
      file: document.file,
      field: "extracted_at",
      problem: `Candidate has been proposed for ${ageDays} days without a final review decision.`,
      fix: "Review the Candidate, add evidence, reject it, or mark it superseded/deprecated."
    });
  }
}

function forEachArray(value, field, callback) {
  if (!Array.isArray(value)) {
    return;
  }
  value.forEach((item, index) => callback(item, `${field}[${index}]`));
}

function isMissing(value) {
  return value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
}

function valueKind(value) {
  if (Array.isArray(value)) {
    return "array";
  }
  return typeof value;
}

function addIssue(target, issue) {
  target.push({
    severity: issue.severity ?? "error",
    file: issue.file,
    field: issue.field,
    problem: issue.problem,
    fix: issue.fix
  });
}

function deleteInternalPaths(result) {
  for (const document of result.documents) {
    delete document.absoluteFile;
  }
}
