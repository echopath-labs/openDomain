import { access, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const DOMAIN_DIRECTORIES = [
  "domain",
  "domain/contexts",
  "domain/concepts",
  "domain/rules",
  "domain/lifecycles",
  "domain/events",
  "domain/candidates"
];

export async function initializeProject(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const today = options.today ?? new Date().toISOString().slice(0, 10);
  const result = {
    target: cwd,
    example: options.example ?? null,
    created: [],
    skipped: [],
    errors: [],
    next_steps: []
  };

  if (options.example && options.example !== "erp") {
    result.errors.push({
      severity: "error",
      file: "<input>",
      field: "example",
      problem: `Unsupported example '${options.example}'.`,
      fix: "Use --example erp or omit --example."
    });
    return result;
  }

  for (const directory of DOMAIN_DIRECTORIES) {
    await ensureDirectory(path.join(cwd, directory), cwd, result);
  }

  await writeFileIfMissing(path.join(cwd, "domain/README.md"), domainReadmeTemplate(), cwd, result);
  await writeFileIfMissing(path.join(cwd, "domain/contexts/example.md"), contextTemplate(), cwd, result);
  await writeFileIfMissing(path.join(cwd, "domain/concepts/example.concept.md"), conceptTemplate(), cwd, result);
  await writeFileIfMissing(
    path.join(cwd, "domain/candidates/candidate-0001-first-domain-model.md"),
    candidateTemplate(today),
    cwd,
    result
  );
  await writeFileIfMissing(path.join(cwd, "AGENTS.md"), agentsTemplate(), cwd, result);

  if (options.example) {
    await copyExample(options.example, cwd, result);
  }

  result.next_steps.push("Edit domain/contexts/example.md and domain/concepts/example.concept.md for your first real bounded context.");
  result.next_steps.push("Run opendomain validate domain.");
  result.next_steps.push("Keep inferred or uncertain business knowledge in domain/candidates/ until human review.");
  if (options.example) {
    result.next_steps.push("Run opendomain validate examples/erp to inspect the copied ERP example.");
  }

  return result;
}

async function copyExample(example, cwd, result) {
  const source = path.join(packageRoot, "examples", example);
  const target = path.join(cwd, "examples", example);

  if (!await exists(source)) {
    result.errors.push({
      severity: "error",
      file: `examples/${example}`,
      field: "$",
      problem: `Bundled example '${example}' is missing.`,
      fix: "Reinstall the OpenDomain package or use a source checkout that includes examples."
    });
    return;
  }

  await copyTree(source, target, cwd, result);
}

async function copyTree(source, target, cwd, result) {
  const sourceStat = await stat(source);
  if (sourceStat.isDirectory()) {
    await ensureDirectory(target, cwd, result);
    const entries = await readdir(source, { withFileTypes: true });
    for (const entry of entries) {
      await copyTree(path.join(source, entry.name), path.join(target, entry.name), cwd, result);
    }
    return;
  }

  if (!sourceStat.isFile()) {
    return;
  }

  const content = await readFile(source, "utf8");
  await writeFileIfMissing(target, content, cwd, result);
}

async function ensureDirectory(directory, cwd, result) {
  if (await exists(directory)) {
    result.skipped.push({ path: relativePath(cwd, directory), reason: "already exists" });
    return;
  }

  await mkdir(directory, { recursive: true });
  result.created.push({ path: relativePath(cwd, directory), kind: "directory" });
}

async function writeFileIfMissing(file, content, cwd, result) {
  if (await exists(file)) {
    result.skipped.push({ path: relativePath(cwd, file), reason: "already exists" });
    return;
  }

  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content, "utf8");
  result.created.push({ path: relativePath(cwd, file), kind: "file" });
}

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

function relativePath(cwd, file) {
  return (path.relative(cwd, file) || ".").split(path.sep).join("/");
}

function domainReadmeTemplate() {
  return `# OpenDomain Model

This directory is the source of truth for long-lived domain semantics.

Start with:

- \`contexts/\`: bounded contexts
- \`concepts/\`: stable business concepts
- \`rules/\`: business rules and invariants
- \`lifecycles/\`: states and transitions
- \`events/\`: business facts that happened
- \`candidates/\`: proposed or inferred domain knowledge awaiting human review

Do not treat generated starter files as accepted business truth. Replace the
example content with reviewed knowledge from your own domain.
`;
}

function contextTemplate() {
  return `---
type: bounded_context
id: example
name: Example
status: proposed
owners:
  - domain-owner
review:
  state: proposed
  suggested_reviewer: domain-owner
---

# Example

Replace this starter bounded context with a real business context from your
system.

## Agent Guidance

Do not treat this starter context as accepted business knowledge until a human
domain owner reviews it and adds evidence.
`;
}

function conceptTemplate() {
  return `---
type: domain_concept
id: example.concept
name: Example Concept
context: example
status: proposed
version: 1
aliases: []
not_synonyms:
  - Implementation Detail
owners:
  - domain-owner
related: []
rules: []
lifecycles: []
events: []
review:
  state: proposed
  suggested_reviewer: domain-owner
---

# Example Concept

Replace this starter concept with a stable business concept from your bounded
context.

## Business Meaning

Describe what this concept means in the business world.

## Not This

- Do not use this file to describe a database table, API shape, or one-time
  feature task unless it represents stable domain meaning.

## Agent Guidance

Keep uncertain or AI-inferred knowledge in \`domain/candidates/\` until human
review.
`;
}

function candidateTemplate(today) {
  return `---
type: domain_candidate
id: candidate-0001-first-domain-model
status: proposed
proposed_change_type: add_concept
target:
  type: domain_concept
  id: example.concept
confidence: low
extracted_by: human-maintainer
extracted_at: ${today}
evidence:
  - type: human_review
    location: opendomain init
    summary: Starter candidate generated as a placeholder for the first reviewed domain model.
    confidence: low
possible_conflicts:
  - Starter content must be replaced with project-specific evidence before acceptance.
review:
  state: proposed
  suggested_reviewer: domain-owner
---

# Candidate: First Domain Model

Use this starter Candidate when you are unsure whether a concept, rule,
lifecycle, or event is truly accepted domain knowledge.

## Requested Human Review

Confirm the business meaning, evidence, owner, and compatibility impact before
promoting any content into accepted OpenDomain files.
`;
}

function agentsTemplate() {
  return `# Repository Agent Instructions

This repository uses OpenDomain for long-lived domain semantics.

Before implementing a non-trivial OpenSpec-style feature, run:

\`\`\`bash
opendomain prepare <feature-spec-or-dir>
\`\`\`

Read files listed under \`Read first\`. Treat files listed under
\`Candidate boundaries\` as proposed knowledge, not accepted truth.

Boundaries:

- OpenDomain stores stable business semantics.
- OpenSpec stores change intent, requirements, tasks, and acceptance criteria.
- AI-inferred domain knowledge starts as a Domain Candidate.
- Accepted domain knowledge requires evidence and human review.
`;
}
