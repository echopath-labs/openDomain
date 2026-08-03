import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import {
  AGENT_ADAPTER_VERSION,
  workspaceConfigTemplate
} from "./agent-resources.mjs";
import { atomicWriteUtf8 } from "./atomic-write.mjs";
import { parseYamlMapping } from "./frontmatter.mjs";
import { validateIntegrationValue } from "./integration-schema-validator.mjs";

export async function planWorkspaceConfig(cwd, requestedTools) {
  const file = path.join(cwd, "opendomain/config.yaml");
  let exists = false;
  let current = "";
  let currentConfig = null;

  try {
    const fileStat = await lstat(file);
    exists = true;
    if (fileStat.isSymbolicLink()) {
      return invalidConfigFilePlan(file, "Workspace configuration must not be a symbolic link.");
    }
    if (!fileStat.isFile()) {
      return invalidConfigFilePlan(file, "Workspace configuration is not a regular file.");
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      return invalidConfigFilePlan(
        file,
        `Workspace configuration cannot be inspected: ${error.message}`
      );
    }
  }

  if (exists) {
    try {
      current = await readFile(file, "utf8");
    } catch (error) {
      return invalidConfigFilePlan(
        file,
        `Workspace configuration cannot be read: ${error.message}`
      );
    }
    try {
      currentConfig = parseYamlMapping(current, "opendomain/config.yaml", {
        label: "Workspace configuration"
      });
    } catch (error) {
      return invalidPlan(file, [{
        severity: "error",
        file: "opendomain/config.yaml",
        field: error.field ?? "$",
        problem: error.problem ?? error.message,
        fix: "Repair the workspace configuration before running init, update, or doctor."
      }]);
    }

    const issues = validateIntegrationValue("workspace", currentConfig).map((issue) => ({
      ...issue,
      file: "opendomain/config.yaml"
    }));
    if (issues.length > 0) {
      return invalidPlan(file, issues);
    }

    const configuredAdapterVersion = currentConfig.agent_integration.adapter_version;
    if (BigInt(configuredAdapterVersion) > BigInt(AGENT_ADAPTER_VERSION)) {
      return invalidPlan(file, [{
        severity: "error",
        file: "opendomain/config.yaml",
        field: "agent_integration.adapter_version",
        problem: `Workspace requires newer adapter contract '${configuredAdapterVersion}', but this CLI supports '${AGENT_ADAPTER_VERSION}'.`,
        fix: "Install a newer OpenDomain CLI before updating this workspace."
      }]);
    }
  }

  const tools = requestedTools ?? currentConfig?.agent_integration?.tools ?? [];
  const content = workspaceConfigTemplate(tools);
  return {
    file,
    relativePath: "opendomain/config.yaml",
    action: !exists ? "create" : content === current ? "skip" : "update",
    content,
    config: {
      schema_version: "1",
      agent_integration: {
        adapter_version: AGENT_ADAPTER_VERSION,
        tools
      }
    },
    tools,
    errors: []
  };
}

export async function applyWorkspaceConfig(plan, result) {
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

function invalidPlan(file, errors) {
  return {
    file,
    relativePath: "opendomain/config.yaml",
    action: "invalid",
    content: null,
    config: null,
    tools: [],
    errors
  };
}

function invalidConfigFilePlan(file, problem) {
  return invalidPlan(file, [{
    severity: "error",
    file: "opendomain/config.yaml",
    field: "$",
    problem,
    fix: "Replace the workspace configuration path with a readable regular file before retrying."
  }]);
}
