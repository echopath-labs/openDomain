---
type: domain_candidate
id: candidate-0012-agent-native-project-adoption
status: proposed
proposed_change_type: add_rule
target:
  type: business_rule
  id: opendomain.project-adoption-must-not-require-host-package-manifest
confidence: high
extracted_by: codex
extracted_at: 2026-08-03
evidence:
  - type: human_review
    location: README.zh-CN.md
    summary: The maintainer requires OpenDomain adoption to avoid forcing npm scripts or a package.json into host projects.
    confidence: high
  - type: code
    location: src/init.mjs
    summary: Project initialization creates canonical semantic and Agent integration files without modifying host package metadata.
    confidence: high
  - type: test
    location: tests/agent-workspace.test.mjs
    summary: Conformance tests require Codex integration to initialize and update without creating package.json or package-lock.json.
    confidence: high
  - type: commit
    location: v0.1.0-alpha.8
    summary: The published alpha.8 release provides npm-global and standalone CLI channels whose registry and native smoke tests initialize Agent-ready non-Node workspaces without host package metadata.
    confidence: high
  - type: spec
    location: https://openspec.dev/docs/how-commands-work
    summary: OpenSpec provides external reference evidence that a globally installed CLI can initialize repository-local Agent resources while keeping terminal operations separate from Agent-chat workflows.
    confidence: medium
possible_conflicts:
  - Users still need either a global npm and Node.js tool environment or a downloaded standalone executable before project initialization.
  - Agent-specific repository files remain necessary even though host language package metadata is not.
  - Repository fixtures and release smoke do not yet prove that installation, initialization, updates, and intent routing remain usable in a real external project.
  - Homebrew may improve installation lifecycle management, but it is an optional channel and does not determine the package-neutral workspace contract.
review:
  state: proposed
  suggested_reviewer: opendomain-maintainer
---

# Candidate: Agent-native Project Adoption

## Proposed Rule

Adopting OpenDomain in a project must not require that project to create or
modify a package manifest, package-manager lockfile, or npm script. Runtime
installation belongs to the user's tool environment; the project contains only
canonical OpenDomain sources and explicitly selected repository-local Agent
integration files.

## Agent Workflow Meaning

Humans should be able to state their goal in natural language. Agent adapters
select deterministic OpenDomain CLI operations for exploration, modeling,
Candidate review, and implementation grounding. Direct CLI commands remain
available for CI, debugging, and advanced use, but they are not the primary
human workflow.

## Requested Human Review

Keep this rule proposed until at least one real external project confirms that
installation, `init --tools codex`, natural-language Agent routing, CLI upgrade,
`opendomain update`, and `doctor` remain practical without host package
metadata. Homebrew is no longer a promotion prerequisite because installation
channel selection is separate from the repository-local Agent workflow
contract.
