import { planAgentSkills } from "./managed-agent-skills.mjs";
import { planManagedAgents } from "./managed-agents.mjs";
import { inspectWorkspaceRoots } from "./workspace-resolver.mjs";
import { planWorkspaceConfig } from "./workspace-config.mjs";

export async function doctorWorkspaceIntegration(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const result = {
    status: "unhealthy",
    target: cwd,
    tools: [],
    checks: [],
    warnings: [],
    errors: []
  };

  const workspace = await inspectWorkspaceRoots({ cwd });
  result.warnings.push(...workspace.warnings);
  result.errors.push(...workspace.errors);
  if (workspace.mode === "canonical" || workspace.mode === "dual") {
    result.checks.push(passCheck("workspace", "opendomain/"));
  } else if (result.errors.length === 0) {
    result.errors.push(failedIssue(
      "opendomain/",
      "$",
      "Canonical OpenDomain workspace is not available.",
      "Run opendomain init --tools codex."
    ));
  }
  if (result.errors.length > 0) {
    return result;
  }

  const configPlan = await planWorkspaceConfig(cwd);
  if (configPlan.action === "create") {
    result.errors.push(failedIssue(
      "opendomain/config.yaml",
      "$",
      "Workspace integration configuration is missing.",
      "Run opendomain init --tools codex."
    ));
    return result;
  }
  if (configPlan.errors.length > 0) {
    result.errors.push(...configPlan.errors);
    return result;
  }
  result.tools = configPlan.tools;
  if (configPlan.action === "skip") {
    result.checks.push(passCheck("config", "opendomain/config.yaml"));
  } else {
    result.errors.push(failedIssue(
      "opendomain/config.yaml",
      "$",
      "Workspace integration configuration is not normalized for this contract version.",
      "Run opendomain update."
    ));
  }

  const agentsPlan = await planManagedAgents(cwd);
  if (agentsPlan.errors.length > 0) {
    result.errors.push(...agentsPlan.errors);
  } else if (agentsPlan.action === "skip") {
    result.checks.push(passCheck("managed_agents", "AGENTS.md"));
  } else {
    result.errors.push(failedIssue(
      "AGENTS.md",
      "$",
      agentsPlan.action === "create"
        ? "OpenDomain managed instruction block is missing."
        : "OpenDomain managed instruction block is stale.",
      "Run opendomain update."
    ));
  }

  const skillPlans = await planAgentSkills(cwd, result.tools);
  result.errors.push(...skillPlans.errors);
  for (const plan of skillPlans.plans) {
    if (plan.action === "skip") {
      result.checks.push(passCheck("agent_skill", plan.path));
    } else {
      result.errors.push(failedIssue(
        plan.path,
        "$",
        plan.action === "create"
          ? `Configured Agent Skill '${plan.path}' is missing.`
          : plan.action === "remove"
            ? `OpenDomain-generated Agent Skill '${plan.path}' is no longer selected.`
            : `Configured Agent Skill '${plan.path}' is stale.`,
        "Run opendomain update."
      ));
    }
  }

  result.status = result.errors.length === 0 ? "healthy" : "unhealthy";
  return result;
}

function passCheck(id, file) {
  return { id, status: "pass", file };
}

function failedIssue(file, field, problem, fix) {
  return { severity: "error", file, field, problem, fix };
}
