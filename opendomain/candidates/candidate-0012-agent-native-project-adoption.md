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
  - type: human_review
    location: INSTALL.md
    summary: The maintainer approved a canonical Agent installation contract in which Codex selects a user-tool installation path, initializes the workspace, and proves readiness without changing host package metadata.
    confidence: high
  - type: test
    location: scripts/smoke-agent-bootstrap.mjs
    summary: A packed OpenDomain CLI installs into an isolated global prefix and initializes a healthy Codex integration in a non-Node workspace without creating package metadata.
    confidence: high
possible_conflicts:
  - The npm path still requires a supported user-level Node.js runtime; standalone binaries provide a fallback but add platform and checksum-selection requirements.
  - Agent-specific repository files remain necessary even though host language package metadata is not.
  - Natural-language installation still depends on Agent discovery plus network, shell, filesystem, and human approval boundaries.
  - The installation contract and isolated smoke do not yet provide external-project adoption or upgrade evidence.
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

Keep this rule proposed until at least one external project adoption and an
upgrade cycle confirm that the package-manager-neutral workspace and Agent
installation contract remain practical outside OpenDomain's own repository.
