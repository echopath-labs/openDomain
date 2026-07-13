---
type: domain_candidate
id: candidate-0004-profile-runtime-normalizes-not-infers
status: proposed
proposed_change_type: add_rule
target:
  type: business_rule
  id: opendomain.profile-runtime-normalizes-not-infers
confidence: high
extracted_by: codex
extracted_at: 2026-07-10
evidence:
  - type: spec
    location: openspec/changes/design-integration-profile-layer/design.md
    summary: The integration design permits bounded deterministic normalization while excluding semantic inference and executable behavior.
    confidence: high
  - type: human_review
    location: conversation:2026-07-10-grill-with-docs-profile-normalization
    summary: The human maintainer confirmed that Profile Runtime may support diverse formats but must preserve a structured, orderly core paradigm.
    confidence: high
possible_conflicts:
  - The exact structured source formats included in the first implementation are not decided yet.
  - The final configuration schema for normalization operations is not implemented yet.
review:
  state: proposed
  suggested_reviewer: opendomain-maintainer
---

# Candidate: Profile Runtime Normalizes, Not Infers

## Proposed Rule

Profile Runtime may perform bounded, deterministic format normalization, but it
must not infer domain semantics or invent OpenDomain IDs.

## Meaning

OpenDomain may accept diverse structured source formats. Profiles can map
explicit source values through field reads, renaming, ordered fallback,
scalar-to-array coercion, deterministic array merging, optional defaults, and
explicit enum mapping.

Every successful profile must produce the same versioned Grounding Request
shape. Input diversity must not weaken the core protocol paradigm.

## Forbidden Behavior

- arbitrary JavaScript, shell, npm plugin, template, or environment execution;
- regex extraction from unstructured Markdown body content;
- LLM or NLP inference inside Profile Runtime;
- automatic creation of missing OpenDomain IDs.

## Compatibility Note

Adding a deterministic source parser or normalization operation is a Profile
Runtime capability change. Changing the resulting stable Grounding Request
shape is a Grounding Protocol compatibility change.

## Requested Human Review

Confirm the first supported source formats and final declarative operation set
before promoting this proposed rule into accepted OpenDomain knowledge.
