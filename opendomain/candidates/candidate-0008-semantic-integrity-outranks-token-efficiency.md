---
type: domain_candidate
id: candidate-0008-semantic-integrity-outranks-token-efficiency
status: proposed
proposed_change_type: add_rule
target:
  type: business_rule
  id: opendomain.semantic-integrity-outranks-token-efficiency
confidence: high
extracted_by: codex
extracted_at: 2026-07-11
evidence:
  - type: spec
    location: openspec/changes/design-integration-profile-layer/design.md
    summary: The Context Budget design preserves semantically required sources and Candidate boundaries regardless of token estimates.
    confidence: high
  - type: human_review
    location: conversation:2026-07-11-semantic-integrity-over-token-efficiency
    summary: The human maintainer confirmed that token savings are a low-priority future benefit and must not affect OpenDomain's most valuable semantic design.
    confidence: high
possible_conflicts:
  - Existing product language may overemphasize low-token retrieval relative to semantic integrity and long-term discoverability.
  - The initial estimator algorithm is approximate and not implemented yet.
review:
  state: proposed
  suggested_reviewer: opendomain-maintainer
---

# Candidate: Semantic Integrity Outranks Token Efficiency

## Proposed Rule

OpenDomain must preserve semantically required accepted sources, Candidate
boundaries, evidence traceability, and long-term discoverability regardless of
token-efficiency goals.

## Meaning

Token estimates and retrieval indexes may help consumers understand or reduce
context cost. They are derived conveniences, not inputs that redefine which
domain semantics are true or required.

Context Budget may report required and optional source cost. It must not
automatically remove accepted sources, hide Candidate boundaries, truncate
semantic files, or change grounding selection.

## Compatibility Note

Future budget limits or selection policies require separate review. They must
remain outside accepted domain truth and must not silently change Grounding
Pack semantics.

## Requested Human Review

Confirm this priority rule before promoting it into accepted OpenDomain
knowledge and revise any public docs that overstate token savings as a core
product value.
