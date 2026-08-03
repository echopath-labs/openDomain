import { readFile, unlink } from "node:fs/promises";
import {
  agentSkillResources,
  allAgentSkillResources
} from "./agent-resources.mjs";
import { atomicWriteUtf8 } from "./atomic-write.mjs";
import { parseMarkdown } from "./frontmatter.mjs";
import {
  ensureManagedFileParent,
  inspectManagedFilePath
} from "./managed-path.mjs";

export async function planAgentSkills(cwd, tools) {
  const plans = [];
  const errors = [];
  const desiredPaths = new Set(
    agentSkillResources(tools).map((resource) => resource.path)
  );

  for (const resource of allAgentSkillResources()) {
    const desired = desiredPaths.has(resource.path);
    const managedPath = await inspectManagedFilePath(cwd, resource.path);
    if (managedPath.issue) {
      errors.push(managedPath.issue);
      continue;
    }
    const file = managedPath.file;
    if (!managedPath.exists) {
      if (desired) {
        plans.push({
          ...resource,
          file,
          projectRoot: managedPath.projectRoot,
          action: "create"
        });
      }
      continue;
    }

    let current;
    try {
      current = await readFile(file, "utf8");
    } catch (error) {
      errors.push(unreadableIssue(resource.path, error));
      continue;
    }
    let parsed;
    try {
      parsed = parseMarkdown(current, resource.path);
    } catch {
      if (desired) {
        errors.push(ownershipIssue(resource.path));
      }
      continue;
    }

    if (parsed.frontmatter.metadata?.generatedBy !== "opendomain") {
      if (desired) {
        errors.push(ownershipIssue(resource.path));
      }
      continue;
    }

    plans.push({
      ...resource,
      file,
      projectRoot: managedPath.projectRoot,
      action: desired
        ? current === resource.content ? "skip" : "update"
        : "remove"
    });
  }

  return { plans, errors };
}

export async function applyAgentSkills(planResult, result) {
  for (const plan of planResult.plans) {
    if (plan.action === "remove") {
      await ensureManagedFileParent(plan.projectRoot, plan.path);
      await unlink(plan.file);
      result.removed.push({ path: plan.path, kind: "file" });
      continue;
    }
    if (plan.action === "skip") {
      result.skipped.push({ path: plan.path, reason: "managed content is current" });
      continue;
    }

    await ensureManagedFileParent(plan.projectRoot, plan.path);
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

function unreadableIssue(file, error) {
  return {
    severity: "error",
    file,
    field: "$",
    problem: `Managed Agent file '${file}' cannot be read: ${error.message}`,
    fix: "Restore read access to the managed Agent file before retrying."
  };
}
