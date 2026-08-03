import { applyAgentSkills, planAgentSkills } from "./managed-agent-skills.mjs";
import { applyManagedAgents, planManagedAgents } from "./managed-agents.mjs";
import { inspectWorkspaceRoots } from "./workspace-resolver.mjs";
import { applyWorkspaceConfig, planWorkspaceConfig } from "./workspace-config.mjs";

export async function updateWorkspaceIntegration(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const result = {
    target: cwd,
    tools: [],
    created: [],
    updated: [],
    removed: [],
    skipped: [],
    warnings: [],
    errors: [],
    next_steps: []
  };

  const workspace = await inspectWorkspaceRoots({ cwd });
  result.warnings.push(...workspace.warnings);
  result.errors.push(...workspace.errors);
  if (result.errors.length > 0) {
    return result;
  }
  if (workspace.mode !== "canonical" && workspace.mode !== "dual") {
    result.errors.push({
      severity: "error",
      file: "opendomain/config.yaml",
      field: "$",
      problem: "Managed Agent integration requires the canonical 'opendomain/' workspace.",
      fix: "Run opendomain init --tools codex before running update."
    });
    return result;
  }

  const configPlan = await planWorkspaceConfig(cwd);
  if (configPlan.action === "create") {
    result.errors.push({
      severity: "error",
      file: "opendomain/config.yaml",
      field: "$",
      problem: "Workspace has not adopted managed Agent integration.",
      fix: "Run opendomain init --tools codex to create the workspace configuration."
    });
    return result;
  }
  if (configPlan.errors.length > 0) {
    result.errors.push(...configPlan.errors);
    return result;
  }
  result.tools = configPlan.tools;

  const agentsPlan = await planManagedAgents(cwd);
  if (agentsPlan.errors.length > 0) {
    result.errors.push(...agentsPlan.errors);
    return result;
  }
  const skillPlans = await planAgentSkills(cwd, result.tools);
  if (skillPlans.errors.length > 0) {
    result.errors.push(...skillPlans.errors);
    return result;
  }

  await applyWorkspaceConfig(configPlan, result);
  await applyManagedAgents(agentsPlan, result);
  await applyAgentSkills(skillPlans, result);
  result.next_steps.push("Run opendomain doctor to verify workspace and Agent integration readiness.");
  return result;
}
