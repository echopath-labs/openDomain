import { validatePath } from "./validator.mjs";
import { formatGroundingPack, prepareGroundingPack } from "./prepare.mjs";
import { initializeProject } from "./init.mjs";
import { listCandidates, reviewCandidate, showCandidate } from "./candidates.mjs";
import {
  DEFAULT_INDEX_PATH,
  buildSemanticIndex,
  querySemanticIndex,
  writeSemanticIndex
} from "./indexer.mjs";

export async function runCli(argv, options = {}) {
  const io = {
    stdout: options.stdout ?? process.stdout,
    stderr: options.stderr ?? process.stderr
  };

  const [command, subcommand, ...rest] = argv;

  if (!command || command === "help" || command === "--help" || command === "-h") {
    printHelp(io.stdout);
    return 0;
  }

  if (command === "validate") {
    return runValidate([subcommand, ...rest].filter(Boolean), io);
  }

  if (command === "prepare") {
    return runPrepare([subcommand, ...rest].filter(Boolean), io);
  }

  if (command === "init") {
    return runInit([subcommand, ...rest].filter(Boolean), io);
  }

  if (command === "index" && subcommand === "build") {
    return runIndexBuild(rest, io);
  }

  if (command === "index" && subcommand === "query") {
    return runIndexQuery(rest, io);
  }

  if (command === "ids" && subcommand === "list") {
    return runIdsList(rest, io);
  }

  if (command === "refs" && subcommand === "check") {
    return runValidate(rest, io);
  }

  if (command === "candidate" && subcommand === "list") {
    return runCandidateList(rest, io);
  }

  if (command === "candidate" && subcommand === "show") {
    return runCandidateShow(rest, io);
  }

  if (command === "candidate" && subcommand === "review") {
    return runCandidateReview(rest, io);
  }

  if (command === "demo" && subcommand === "order-cancellation") {
    return runOrderCancellationDemo(io);
  }

  io.stderr.write(`Unknown command: ${argv.join(" ")}\n`);
  printHelp(io.stderr);
  return 1;
}

function printHelp(stream) {
  stream.write(`OpenDomain CLI

Usage:
  opendomain init [--example erp] [--json]
  opendomain validate [path] [--json]
  opendomain prepare [--integration openspec] <feature-spec-or-dir> [--json]
  opendomain index build [path] [--out <file>] [--json]
  opendomain index query <domain-id> [--index <file>] [--json]
  opendomain index query --context <context-id> [--index <file>] [--json]
  opendomain ids list [path] [--json]
  opendomain refs check [path] [--json]
  opendomain candidate list [path] [--json]
  opendomain candidate show <candidate-id> [path] [--json]
  opendomain candidate review <candidate-id> --decision <decision> --reviewed-by <name> --reason <text> [path] [--json]
  opendomain demo order-cancellation

`);
}

function splitArgs(args) {
  return {
    json: args.includes("--json"),
    paths: args.filter((arg) => arg !== "--json")
  };
}

async function runInit(args, io) {
  const parsed = parseInitArgs(args);

  if (parsed.errors.length > 0) {
    const result = {
      target: process.cwd(),
      example: parsed.example ?? null,
      created: [],
      skipped: [],
      errors: parsed.errors,
      next_steps: []
    };
    if (parsed.json) {
      io.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      printInitResult(result, io.stdout);
    }
    return 1;
  }

  const result = await initializeProject({ cwd: process.cwd(), example: parsed.example });
  if (parsed.json) {
    io.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    printInitResult(result, io.stdout);
  }

  return result.errors.length > 0 ? 1 : 0;
}

async function runValidate(args, io) {
  const { json, paths } = splitArgs(args);
  const result = await validatePath(paths[0], { cwd: process.cwd() });

  if (json) {
    io.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    printValidationResult(result, io.stdout);
  }

  return result.errors.length > 0 ? 1 : 0;
}

async function runCandidateList(args, io) {
  const parsed = parseCandidatePathArgs(args);
  const result = await listCandidates(parsed.path, { cwd: process.cwd() });

  if (parsed.json) {
    io.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    printCandidateListResult(result, io.stdout);
  }

  return result.errors.length > 0 ? 1 : 0;
}

async function runCandidateShow(args, io) {
  const parsed = parseCandidateShowArgs(args);
  const result = parsed.errors.length > 0
    ? { source: parsed.path ?? "<default>", candidate: null, warnings: [], errors: parsed.errors }
    : await showCandidate(parsed.id, parsed.path, { cwd: process.cwd() });

  if (parsed.json) {
    io.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    printCandidateShowResult(result, io.stdout);
  }

  return result.errors.length > 0 ? 1 : 0;
}

async function runCandidateReview(args, io) {
  const parsed = parseCandidateReviewArgs(args);
  const result = parsed.errors.length > 0
    ? {
        candidate: null,
        decision: parsed.decision ?? null,
        effective_state: null,
        file: null,
        warnings: [],
        errors: parsed.errors
      }
    : await reviewCandidate(parsed.id, parsed.path, {
        decision: parsed.decision,
        reviewedBy: parsed.reviewedBy,
        reviewedAt: parsed.reviewedAt,
        reason: parsed.reason
      }, { cwd: process.cwd() });

  if (parsed.json) {
    io.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    printCandidateReviewResult(result, io.stdout);
  }

  return result.errors.length > 0 ? 1 : 0;
}

function parseInitArgs(args) {
  const parsed = {
    json: false,
    example: undefined,
    errors: []
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--json") {
      parsed.json = true;
      continue;
    }
    if (arg === "--example") {
      parsed.example = args[index + 1];
      index += 1;
      if (!parsed.example) {
        parsed.errors.push({
          severity: "error",
          file: "<input>",
          field: "example",
          problem: "Missing example name.",
          fix: "Use --example erp."
        });
      }
      continue;
    }

    parsed.errors.push({
      severity: "error",
      file: "<input>",
      field: "$",
      problem: `Unknown init argument '${arg}'.`,
      fix: "Run opendomain init, opendomain init --example erp, or add --json."
    });
  }

  return parsed;
}

function parseCandidatePathArgs(args) {
  const parsed = {
    json: false,
    path: undefined
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--json") {
      parsed.json = true;
      continue;
    }
    if (!parsed.path) {
      parsed.path = arg;
    }
  }

  return parsed;
}

function parseCandidateShowArgs(args) {
  const parsed = {
    json: false,
    id: undefined,
    path: undefined,
    errors: []
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--json") {
      parsed.json = true;
      continue;
    }
    if (!parsed.id) {
      parsed.id = arg;
      continue;
    }
    if (!parsed.path) {
      parsed.path = arg;
    }
  }

  if (!parsed.id) {
    parsed.errors.push({
      severity: "error",
      file: "<input>",
      field: "candidate_id",
      problem: "Missing Candidate id.",
      fix: "Run opendomain candidate show <candidate-id>."
    });
  }

  return parsed;
}

function parseCandidateReviewArgs(args) {
  const parsed = {
    json: false,
    id: undefined,
    decision: undefined,
    reviewedBy: undefined,
    reviewedAt: undefined,
    reason: undefined,
    path: undefined,
    errors: []
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--json") {
      parsed.json = true;
      continue;
    }
    if (arg === "--decision") {
      parsed.decision = args[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--reviewed-by") {
      parsed.reviewedBy = args[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--reviewed-at") {
      parsed.reviewedAt = args[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--reason") {
      parsed.reason = args[index + 1];
      index += 1;
      continue;
    }
    if (!parsed.id) {
      parsed.id = arg;
      continue;
    }
    if (!parsed.path) {
      parsed.path = arg;
    }
  }

  if (!parsed.id) {
    parsed.errors.push({
      severity: "error",
      file: "<input>",
      field: "candidate_id",
      problem: "Missing Candidate id.",
      fix: "Run opendomain candidate review <candidate-id> --decision <decision> --reviewed-by <name> --reason <text>."
    });
  }

  return parsed;
}

async function runPrepare(args, io) {
  const parsed = parsePrepareArgs(args);
  const pack = await prepareGroundingPack(parsed.path, {
    cwd: process.cwd(),
    integration: parsed.integration
  });

  if (parsed.json) {
    io.stdout.write(`${JSON.stringify(pack, null, 2)}\n`);
  } else {
    io.stdout.write(formatGroundingPack(pack));
  }

  return pack.errors.length > 0 ? 1 : 0;
}

function parsePrepareArgs(args) {
  const parsed = {
    json: false,
    integration: "auto",
    path: undefined
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--json") {
      parsed.json = true;
      continue;
    }
    if (arg === "--integration") {
      parsed.integration = args[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (!parsed.path) {
      parsed.path = arg;
    }
  }

  return parsed;
}

async function runIndexBuild(args, io) {
  const parsed = parseIndexBuildArgs(args);
  const result = await buildSemanticIndex(parsed.path, { cwd: process.cwd() });

  if (result.errors.length === 0) {
    const file = await writeSemanticIndex(result.index, parsed.out, { cwd: process.cwd() });
    result.file = file;
  }

  if (parsed.json) {
    io.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    printIndexBuildResult(result, io.stdout);
  }

  return result.errors.length > 0 ? 1 : 0;
}

async function runIndexQuery(args, io) {
  const parsed = parseIndexQueryArgs(args);
  if (parsed.errors.length > 0) {
    const result = {
      query: parsed.context ? { context: parsed.context } : { id: parsed.id },
      read_first: [],
      accepted_ids: [],
      candidate_boundaries: [],
      verify_with: [],
      warnings: [],
      errors: parsed.errors
    };
    if (parsed.json) {
      io.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      printIndexQueryResult(result, io.stdout);
    }
    return 1;
  }

  let result;
  try {
    result = await querySemanticIndex(
      parsed.context ? { context: parsed.context } : { id: parsed.id },
      { cwd: process.cwd(), indexPath: parsed.indexPath }
    );
  } catch (error) {
    result = {
      query: parsed.context ? { context: parsed.context } : { id: parsed.id },
      read_first: [],
      accepted_ids: [],
      candidate_boundaries: [],
      verify_with: [],
      warnings: [],
      errors: [{
        severity: "error",
        file: parsed.indexPath,
        field: "$",
        problem: error instanceof Error ? error.message : String(error),
        fix: "Run opendomain index build or pass --index <file>."
      }]
    };
  }

  if (parsed.json) {
    io.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    printIndexQueryResult(result, io.stdout);
  }

  return result.errors.length > 0 ? 1 : 0;
}

async function runIdsList(args, io) {
  const { json, paths } = splitArgs(args);
  const result = await validatePath(paths[0], { cwd: process.cwd() });
  const ids = result.documents
    .filter((document) => document.id)
    .map((document) => ({
      id: document.id,
      type: document.type,
      file: document.file
    }))
    .sort((left, right) => left.id.localeCompare(right.id));

  if (json) {
    io.stdout.write(`${JSON.stringify({ ids }, null, 2)}\n`);
  } else {
    for (const item of ids) {
      io.stdout.write(`${item.id}\t${item.type}\t${item.file}\n`);
    }
  }

  return result.errors.length > 0 ? 1 : 0;
}

function parseIndexBuildArgs(args) {
  const parsed = {
    json: false,
    out: DEFAULT_INDEX_PATH,
    path: undefined
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--json") {
      parsed.json = true;
      continue;
    }
    if (arg === "--out") {
      parsed.out = args[index + 1] ?? DEFAULT_INDEX_PATH;
      index += 1;
      continue;
    }
    if (!parsed.path) {
      parsed.path = arg;
    }
  }

  return parsed;
}

function parseIndexQueryArgs(args) {
  const parsed = {
    json: false,
    indexPath: DEFAULT_INDEX_PATH,
    id: undefined,
    context: undefined,
    errors: []
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--json") {
      parsed.json = true;
      continue;
    }
    if (arg === "--index") {
      parsed.indexPath = args[index + 1] ?? DEFAULT_INDEX_PATH;
      index += 1;
      continue;
    }
    if (arg === "--context") {
      parsed.context = args[index + 1];
      index += 1;
      continue;
    }
    if (!parsed.id) {
      parsed.id = arg;
    }
  }

  if (!parsed.id && !parsed.context) {
    parsed.errors.push({
      severity: "error",
      file: "<input>",
      field: "$",
      problem: "Missing index query id or context.",
      fix: "Run opendomain index query <domain-id> or opendomain index query --context <context-id>."
    });
  }

  if (parsed.id && parsed.context) {
    parsed.errors.push({
      severity: "error",
      file: "<input>",
      field: "$",
      problem: "Index query received both id and context.",
      fix: "Query either a single id or a context, not both."
    });
  }

  return parsed;
}

function printIndexBuildResult(result, stream) {
  if (result.errors.length > 0) {
    stream.write(`Semantic Retrieval Index build failed: ${result.errors.length} errors.\n`);
    for (const issue of [...result.errors, ...result.warnings]) {
      stream.write(`\n[${issue.severity}] ${issue.file}\n`);
      stream.write(`  field: ${issue.field}\n`);
      stream.write(`  problem: ${issue.problem}\n`);
      stream.write(`  fix: ${issue.fix}\n`);
    }
    return;
  }

  stream.write("Semantic Retrieval Index built.\n\n");
  stream.write(`File: ${result.file}\n`);
  stream.write(`Schema: ${result.index.schema}\n`);
  stream.write(`Entries: ${result.index.entries.length}\n`);
  stream.write("Boundary: derived view only; OpenDomain source files remain authoritative.\n");

  if (result.warnings.length > 0) {
    stream.write("\nWarnings:\n");
    for (const warning of result.warnings) {
      stream.write(`- ${warning.file} ${warning.field}: ${warning.problem}\n`);
    }
  }
}

function printCandidateListResult(result, stream) {
  if (result.errors.length > 0) {
    stream.write(`Candidate list failed: ${result.errors.length} errors.\n`);
    printIssues(result.errors, stream);
    return;
  }

  stream.write("Domain Candidates\n\n");
  stream.write(`Source: ${result.source}\n`);
  stream.write("Boundary: Candidates are not accepted OpenDomain knowledge.\n\n");

  if (result.candidates.length === 0) {
    stream.write("- None\n");
  } else {
    for (const candidate of result.candidates) {
      stream.write(`- ${candidate.id} [${candidate.status}] -> ${candidate.target?.id ?? "<unknown>"}\n`);
      stream.write(`  file: ${candidate.file}\n`);
      stream.write(`  change: ${candidate.proposed_change_type}\n`);
      stream.write(`  confidence: ${candidate.confidence}\n`);
      stream.write(`  reviewer: ${candidate.suggested_reviewer ?? "<none>"}\n`);
      if (candidate.reviewed_by) {
        stream.write(`  reviewed_by: ${candidate.reviewed_by}\n`);
      }
    }
  }

  if (result.warnings.length > 0) {
    stream.write("\nWarnings:\n");
    for (const warning of result.warnings) {
      stream.write(`- ${warning.file} ${warning.field}: ${warning.problem}\n`);
    }
  }
}

function printCandidateShowResult(result, stream) {
  if (result.errors.length > 0) {
    stream.write(`Candidate show failed: ${result.errors.length} errors.\n`);
    printIssues(result.errors, stream);
    return;
  }

  const candidate = result.candidate;
  stream.write(`Domain Candidate: ${candidate.id}\n\n`);
  stream.write(`Status: ${candidate.status}\n`);
  stream.write(`Review state: ${candidate.review_state}\n`);
  stream.write(`File: ${candidate.file}\n`);
  stream.write(`Target: ${candidate.target?.type ?? "<unknown>"} ${candidate.target?.id ?? "<unknown>"}\n`);
  stream.write(`Change: ${candidate.proposed_change_type}\n`);
  stream.write(`Confidence: ${candidate.confidence}\n`);
  stream.write(`Suggested reviewer: ${candidate.suggested_reviewer ?? "<none>"}\n`);
  stream.write(`Boundary: ${result.boundary}\n\n`);

  stream.write("Evidence:\n");
  if (candidate.evidence.length === 0) {
    stream.write("- None\n");
  } else {
    for (const evidence of candidate.evidence) {
      stream.write(`- ${evidence.type} (${evidence.confidence}) ${evidence.location}: ${evidence.summary}\n`);
    }
  }

  stream.write("\nPossible conflicts:\n");
  if (candidate.possible_conflicts.length === 0) {
    stream.write("- None\n");
  } else {
    for (const conflict of candidate.possible_conflicts) {
      stream.write(`- ${conflict}\n`);
    }
  }

  if (candidate.body) {
    stream.write(`\nProposed content:\n${candidate.body}\n`);
  }

  if (result.warnings.length > 0) {
    stream.write("\nWarnings:\n");
    for (const warning of result.warnings) {
      stream.write(`- ${warning.file} ${warning.field}: ${warning.problem}\n`);
    }
  }
}

function printCandidateReviewResult(result, stream) {
  if (result.errors.length > 0) {
    stream.write(`Candidate review failed: ${result.errors.length} errors.\n`);
    printIssues(result.errors, stream);
    return;
  }

  stream.write("Candidate review recorded.\n\n");
  stream.write(`Candidate: ${result.candidate?.id ?? "<unknown>"}\n`);
  stream.write(`Decision: ${result.decision}\n`);
  stream.write(`Recorded state: ${result.effective_state}\n`);
  stream.write(`File: ${result.file}\n`);
  stream.write(`Boundary: ${result.boundary}\n`);
  if (result.promotion_required) {
    stream.write("Next step: manually update accepted OpenDomain source files with evidence and human review metadata.\n");
  }

  if (result.warnings.length > 0) {
    stream.write("\nWarnings:\n");
    for (const warning of result.warnings) {
      stream.write(`- ${warning.file} ${warning.field}: ${warning.problem}\n`);
    }
  }
}

function printInitResult(result, stream) {
  if (result.errors.length > 0) {
    stream.write(`OpenDomain init failed: ${result.errors.length} errors.\n`);
    for (const issue of result.errors) {
      stream.write(`\n[${issue.severity}] ${issue.file}\n`);
      stream.write(`  field: ${issue.field}\n`);
      stream.write(`  problem: ${issue.problem}\n`);
      stream.write(`  fix: ${issue.fix}\n`);
    }
    return;
  }

  stream.write("OpenDomain init completed.\n\n");
  stream.write(`Target: ${result.target}\n`);
  if (result.example) {
    stream.write(`Example: ${result.example}\n`);
  }

  stream.write("\nCreated:\n");
  if (result.created.length === 0) {
    stream.write("- None\n");
  } else {
    for (const item of result.created) {
      stream.write(`- ${item.path}\n`);
    }
  }

  stream.write("\nSkipped:\n");
  if (result.skipped.length === 0) {
    stream.write("- None\n");
  } else {
    for (const item of result.skipped) {
      stream.write(`- ${item.path} (${item.reason})\n`);
    }
  }

  stream.write("\nNext steps:\n");
  for (const step of result.next_steps) {
    stream.write(`- ${step}\n`);
  }
}

function printIndexQueryResult(result, stream) {
  if (result.errors.length > 0) {
    stream.write(`Semantic Retrieval Index query failed: ${result.errors.length} errors.\n`);
    for (const issue of result.errors) {
      stream.write(`\n[${issue.severity}] ${issue.file}\n`);
      stream.write(`  field: ${issue.field}\n`);
      stream.write(`  problem: ${issue.problem}\n`);
      stream.write(`  fix: ${issue.fix}\n`);
    }
    return;
  }

  stream.write("Semantic Retrieval Index Read-First Plan\n\n");
  stream.write(`Query: ${result.query.id ?? `context:${result.query.context}`}\n`);
  stream.write(`Index: ${result.index_file}\n`);
  stream.write("Boundary: source files are authoritative; this index only locates what to read.\n\n");

  stream.write("Read first:\n");
  if (result.read_first.length === 0) {
    stream.write("- None\n");
  } else {
    for (const item of result.read_first) {
      stream.write(`- ${item.id} (${item.type}) -> ${item.source_file}\n`);
    }
  }

  stream.write("\nCandidate boundaries:\n");
  if (result.candidate_boundaries.length === 0) {
    stream.write("- None\n");
  } else {
    for (const item of result.candidate_boundaries) {
      stream.write(`- ${item.id} -> ${item.source_file}\n`);
      stream.write(`  target: ${item.target_id}\n`);
      stream.write(`  status: ${item.status}\n`);
    }
  }

  if (result.warnings.length > 0) {
    stream.write("\nWarnings:\n");
    for (const warning of result.warnings) {
      stream.write(`- ${warning.problem}\n`);
    }
  }
}

async function runOrderCancellationDemo(io) {
  const result = await validatePath("examples/erp", { cwd: process.cwd() });
  const feature = result.documents.find((document) => document.id === "spec.order-cancellation");
  const references = feature?.frontmatter?.affects_domain ?? {};

  io.stdout.write(`Order Cancellation Grounding Demo

Feature: spec.order-cancellation
Referenced concepts: ${(references.concepts ?? []).join(", ")}
Referenced rules: ${(references.rules ?? []).join(", ")}
Referenced lifecycles: ${(references.lifecycles ?? []).join(", ")}

Avoided semantic error:
Do not add direct deletion behavior for confirmed orders. Use cancellation semantics and keep uncertain Closed lifecycle evidence as a Candidate until human review.

Validation: ${result.errors.length === 0 ? "passed" : "failed"}
`);

  if (result.errors.length > 0) {
    printValidationResult(result, io.stdout);
    return 1;
  }

  return 0;
}

function printValidationResult(result, stream) {
  if (result.errors.length === 0) {
    stream.write(`OpenDomain validation passed: ${result.documents.length} documents checked`);
    if (result.warnings.length > 0) {
      stream.write(`, ${result.warnings.length} warnings`);
    }
    stream.write(".\n");
  } else {
    stream.write(`OpenDomain validation failed: ${result.errors.length} errors`);
    if (result.warnings.length > 0) {
      stream.write(`, ${result.warnings.length} warnings`);
    }
    stream.write(".\n");
  }

  for (const issue of [...result.errors, ...result.warnings]) {
    printIssue(issue, stream);
  }
}

function printIssues(issues, stream) {
  for (const issue of issues) {
    printIssue(issue, stream);
  }
}

function printIssue(issue, stream) {
  stream.write(`\n[${issue.severity}] ${issue.file}\n`);
  stream.write(`  field: ${issue.field}\n`);
  stream.write(`  problem: ${issue.problem}\n`);
  stream.write(`  fix: ${issue.fix}\n`);
}
