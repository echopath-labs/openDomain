import { stringify as stringifyYaml } from "yaml";

export const AGENT_ADAPTER_VERSION = "1";
export const WORKSPACE_CONFIG_SCHEMA_VERSION = "1";
export const SUPPORTED_AGENT_TOOLS = Object.freeze(["codex"]);

const CODEX_SKILLS = Object.freeze([
  Object.freeze({
    name: "opendomain-explore",
    description: "Explore accepted OpenDomain semantics and Candidate boundaries without changing the domain model.",
    body: `Explore the project's OpenDomain model without mutating it.

1. Run \`opendomain validate\` before relying on workspace sources.
2. Use \`opendomain ids list\` or the semantic index to find the smallest relevant accepted sources.
3. Read accepted concepts, rules, lifecycles, events, and their evidence.
4. Keep every Domain Candidate visibly separate from accepted knowledge.
5. Report gaps or conflicts; do not silently resolve or promote them.
`
  }),
  Object.freeze({
    name: "opendomain-model",
    description: "Build or refine an OpenDomain model while keeping inferred knowledge in Candidate form until human review.",
    body: `Build or refine the project's long-lived domain model.

1. Separate stable business semantics from delivery intent and implementation details.
2. Read existing accepted sources and evidence before proposing changes.
3. Record uncertain, inferred, or conflicting knowledge as a Domain Candidate first.
4. Run \`opendomain validate\` after changing OpenDomain files.
5. Never accept a Candidate without an explicit human review decision.
`
  }),
  Object.freeze({
    name: "opendomain-review",
    description: "Review OpenDomain Candidates with evidence and conflicts while preserving explicit human decision ownership.",
    body: `Review a Domain Candidate without treating it as accepted truth.

1. Use \`opendomain candidate show <candidate-id>\` to inspect the proposal.
2. Read its evidence, target, confidence, conflicts, and existing accepted sources.
3. Explain compatibility impact and unresolved uncertainty to the human reviewer.
4. Invoke \`opendomain candidate review\` only after the human explicitly chooses a decision, reviewer, and reason.
5. Run \`opendomain validate\` after a review mutation.
`
  })
]);

export function workspaceConfigTemplate(tools = []) {
  return stringifyYaml({
    schema_version: WORKSPACE_CONFIG_SCHEMA_VERSION,
    agent_integration: {
      adapter_version: AGENT_ADAPTER_VERSION,
      tools
    }
  }, { lineWidth: 0 });
}

export function managedAgentsTemplate() {
  return `<!-- opendomain:managed:start -->
## OpenDomain

This repository uses OpenDomain for long-lived business semantics.

Before implementing a non-trivial change with an applicable Source Unit, run:

\`\`\`bash
opendomain assure <source-unit>
\`\`\`

Read every accepted source listed in \`grounding_pack.read_first\`. Treat
\`grounding_pack.candidate_boundaries\` as proposed knowledge, never accepted
truth. Report the accepted IDs and Candidate boundaries used when completing
the task.

AI-inferred domain knowledge starts as a Domain Candidate. Human reviewers own
acceptance, rejection, risk decisions, and final validation.
<!-- opendomain:managed:end -->
`;
}

export function agentSkillResources(tools = []) {
  if (!tools.includes("codex")) {
    return [];
  }

  return allAgentSkillResources();
}

export function allAgentSkillResources() {
  return CODEX_SKILLS.map((skill) => ({
    path: `.codex/skills/${skill.name}/SKILL.md`,
    content: `---
name: ${skill.name}
description: ${skill.description}
compatibility: Requires the opendomain CLI.
metadata:
  generatedBy: opendomain
  adapterVersion: "${AGENT_ADAPTER_VERSION}"
---

${skill.body}`
  }));
}
