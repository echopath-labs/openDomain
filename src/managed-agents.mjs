import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { managedAgentsTemplate } from "./agent-resources.mjs";
import { atomicWriteUtf8 } from "./atomic-write.mjs";

export const AGENTS_START_MARKER = "<!-- opendomain:managed:start -->";
export const AGENTS_END_MARKER = "<!-- opendomain:managed:end -->";

export async function planManagedAgents(cwd) {
  const file = path.join(cwd, "AGENTS.md");
  const exists = await fileExists(file);
  const current = exists ? await readFile(file, "utf8") : "";
  const starts = markerIndexes(current, AGENTS_START_MARKER);
  const ends = markerIndexes(current, AGENTS_END_MARKER);

  if (starts.length > 1 || ends.length > 1 || starts.length !== ends.length) {
    return invalidPlan(file);
  }
  if (starts.length === 1 && starts[0] > ends[0]) {
    return invalidPlan(file);
  }

  const template = managedAgentsTemplate().trimEnd();
  let content;
  if (starts.length === 0) {
    const separator = current.length === 0
      ? ""
      : current.endsWith("\n\n")
        ? ""
        : current.endsWith("\n")
          ? "\n"
          : "\n\n";
    content = `${current}${separator}${template}\n`;
  } else {
    const end = ends[0] + AGENTS_END_MARKER.length;
    content = `${current.slice(0, starts[0])}${template}${current.slice(end)}`;
  }

  return {
    file,
    relativePath: "AGENTS.md",
    action: !exists ? "create" : content === current ? "skip" : "update",
    content,
    errors: []
  };
}

export async function applyManagedAgents(plan, result) {
  if (plan.action === "skip") {
    result.skipped.push({ path: plan.relativePath, reason: "managed content is current" });
    return;
  }

  await atomicWriteUtf8(plan.file, plan.content);

  if (plan.action === "create") {
    result.created.push({ path: plan.relativePath, kind: "file" });
  } else {
    result.updated.push({ path: plan.relativePath, kind: "file" });
  }
}

function invalidPlan(file) {
  return {
    file,
    relativePath: "AGENTS.md",
    action: "invalid",
    content: null,
    errors: [{
      severity: "error",
      file: "AGENTS.md",
      field: "$",
      problem: "OpenDomain managed markers are malformed or ambiguous.",
      fix: `Keep exactly one '${AGENTS_START_MARKER}' followed by exactly one '${AGENTS_END_MARKER}', or remove both markers before retrying.`
    }]
  };
}

function markerIndexes(value, marker) {
  const indexes = [];
  let cursor = 0;
  while (cursor <= value.length) {
    const index = value.indexOf(marker, cursor);
    if (index === -1) {
      break;
    }
    indexes.push(index);
    cursor = index + marker.length;
  }
  return indexes;
}

async function fileExists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}
