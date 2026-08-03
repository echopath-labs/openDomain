import { access, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { agentSkillResources } from "./agent-resources.mjs";
import { atomicWriteUtf8 } from "./atomic-write.mjs";
import { parseMarkdown } from "./frontmatter.mjs";

export async function planAgentSkills(cwd, tools) {
  const plans = [];
  const errors = [];

  for (const resource of agentSkillResources(tools)) {
    const file = path.join(cwd, resource.path);
    if (!await fileExists(file)) {
      plans.push({ ...resource, file, action: "create" });
      continue;
    }

    const current = await readFile(file, "utf8");
    let parsed;
    try {
      parsed = parseMarkdown(current, resource.path);
    } catch {
      errors.push(ownershipIssue(resource.path));
      continue;
    }

    if (parsed.frontmatter.metadata?.generatedBy !== "opendomain") {
      errors.push(ownershipIssue(resource.path));
      continue;
    }

    plans.push({
      ...resource,
      file,
      action: current === resource.content ? "skip" : "update"
    });
  }

  return { plans, errors };
}

export async function applyAgentSkills(planResult, result) {
  for (const plan of planResult.plans) {
    if (plan.action === "skip") {
      result.skipped.push({ path: plan.path, reason: "managed content is current" });
      continue;
    }

    await mkdir(path.dirname(plan.file), { recursive: true });
    await atomicWriteUtf8(plan.file, plan.content);

    if (plan.action === "create") {
      result.created.push({ path: plan.path, kind: "file" });
    } else {
      result.updated.push({ path: plan.path, kind: "file" });
    }
  }
}

function ownershipIssue(file) {
  return {
    severity: "error",
    file,
    field: "metadata.generatedBy",
    problem: `Existing '${file}' is not OpenDomain-generated.`,
    fix: "Move or rename the user-owned file before enabling this OpenDomain Agent adapter."
  };
}

async function fileExists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}
