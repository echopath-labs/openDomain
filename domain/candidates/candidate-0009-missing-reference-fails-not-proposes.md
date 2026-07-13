---
type: domain_candidate
id: candidate-0009-missing-reference-fails-not-proposes
status: proposed
proposed_change_type: add_rule
target:
  type: business_rule
  id: opendomain.missing-reference-fails-not-proposes
confidence: high
extracted_by: codex
extracted_at: 2026-07-11
evidence:
  - type: spec
    location: openspec/changes/design-integration-profile-layer/design.md
    summary: The integration design requires deterministic failure and excludes automatic Candidate creation from prepare.
    confidence: high
  - type: human_review
    location: conversation:2026-07-11-grill-with-docs-missing-reference
    summary: The human maintainer confirmed that missing-reference Candidate generation is outside the current milestone.
    confidence: high
possible_conflicts:
  - Future explicit proposal command UX is not designed yet.
review:
  state: proposed
  suggested_reviewer: opendomain-maintainer
---

# Candidate: Missing Reference Fails, Not Proposes

## Proposed Rule

When a Grounding Request references a missing OpenDomain ID, preparation must
fail deterministically and must not automatically create a Domain Candidate.

## Meaning

A missing ID is usually a typo, stale reference, or Profile mapping error. The
string alone does not provide evidence, confidence, proposed content, or enough
meaning for a valid Candidate.

Diagnostics identify the source, field, and missing ID. No Grounding Pack is
presented as successful.

## Future Boundary

A future explicit Candidate proposal workflow may investigate a missing
reference only when the user supplies evidence and proposed content. It remains
Candidate-only and cannot write accepted knowledge.

## Compatibility Note

Changing `prepare` from deterministic failure to automatic proposal would alter
Grounding Protocol error semantics and require explicit compatibility review.

## Requested Human Review

Review this proposed rule before promoting it into accepted OpenDomain
knowledge.
