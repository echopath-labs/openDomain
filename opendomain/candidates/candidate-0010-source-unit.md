---
type: domain_candidate
id: candidate-0010-source-unit
status: proposed
proposed_change_type: add_concept
target:
  type: domain_concept
  id: opendomain.source-unit
confidence: medium
extracted_by: codex
extracted_at: 2026-07-11
evidence:
  - type: spec
    location: openspec/changes/design-integration-profile-layer/design.md
    summary: The integration design defines Source Unit as the deterministic file-or-bundle boundary resolved before Grounding Request normalization.
    confidence: high
  - type: spec
    location: openspec/changes/design-integration-profile-layer/retrospective.md
    summary: Read-only project rehearsal showed that external planning inputs may be directory bundles rather than single feature files.
    confidence: high
  - type: human_review
    location: conversation:2026-07-11-source-unit-design-probe
    summary: The human maintainer chose to translate real-project findings directly into general OpenDomain capabilities instead of building a project-specific vertical slice.
    confidence: high
possible_conflicts:
  - Source Unit may remain a replaceable Profile Runtime implementation concept rather than accepted OpenDomain product semantics.
  - The resolved descriptor roles and future declarative Profile syntax may change before the first implementation.
review:
  state: proposed
  suggested_reviewer: opendomain-maintainer
---

# Candidate: Source Unit

## Proposed Concept

A Source Unit is the deterministic logical boundary of one external change,
specification, task, or planning input before Profile Runtime normalizes it into
a Grounding Request.

Source Unit may represent one structured file or one directory bundle with
explicitly resolved members. It records source structure and traceability, not
accepted domain truth.

## Proposed Boundaries

- It belongs to Profile Runtime, not the stable Grounding Protocol.
- It contains no inferred OpenDomain IDs or copied domain definitions.
- It resolves only declared structured members and does not scan arbitrary
  prose.
- Its stable Grounding Request projection remains `source.type` and
  `source.path`.
- Tool-specific formats use Profiles or thin presets over the same Source Unit
  contract.

## Requested Human Review

Confirm whether Source Unit should become an accepted OpenDomain self-model
concept or remain design-only terminology inside Profile Runtime.
