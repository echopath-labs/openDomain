---
type: domain_candidate
id: candidate-0006-opendomain-workspace
status: proposed
proposed_change_type: add_concept
target:
  type: domain_concept
  id: opendomain.workspace
confidence: high
extracted_by: codex
extracted_at: 2026-07-10
evidence:
  - type: spec
    location: openspec/changes/design-integration-profile-layer/design.md
    summary: The design defines opendomain as the canonical workspace with direct semantic, integration, and generated directories.
    confidence: high
  - type: human_review
    location: conversation:2026-07-10-grill-with-docs-workspace-tree
    summary: The human maintainer confirmed the direct semantic directory layout with integrations and generated output under opendomain.
    confidence: high
  - type: human_review
    location: conversation:2026-07-11-grill-with-docs-workspace-migration
    summary: The human maintainer confirmed legacy fallback through 0.x and non-destructive migration into the canonical workspace.
    confidence: high
possible_conflicts:
  - Current implementation and documentation still use domain and .opendomain paths.
review:
  state: proposed
  suggested_reviewer: opendomain-maintainer
---

# Candidate: OpenDomain Workspace

## Proposed Concept

OpenDomain Workspace is the canonical repository-local namespace that contains
OpenDomain configuration, semantic source files, Candidates, Integration
Profiles, and generated retrieval output.

## Proposed Structure

```text
opendomain/
  README.md
  config.yaml
  contexts/
  concepts/
  rules/
  lifecycles/
  events/
  candidates/
  integrations/
    profiles/
  generated/
    index.json
```

Semantic directories are directly available under `opendomain/`. The workspace
does not add a `model/` or `knowledge/` nesting layer.

## Generated Boundary

`generated/` contains rebuildable derived output. Source hashes or equivalent
freshness checks prevent generated files from replacing semantic source truth.
Users decide whether generated files are tracked or ignored.

## Compatibility Note

Replacing `domain/` and `.opendomain/` paths is an alpha workspace compatibility
change. During `0.x`, legacy `domain/` remains readable when `opendomain/` is
absent. If both roots exist, canonical `opendomain/` wins with a warning.

Migration copies and validates source content without overwriting targets,
deleting legacy files, changing Git state, or editing ignore rules. Legacy
indexes are rebuilt under `opendomain/generated/`. Legacy discovery may be
removed only in `1.0` with explicit migration guidance.

## Requested Human Review

Review the confirmed workspace and migration contract before promotion.
