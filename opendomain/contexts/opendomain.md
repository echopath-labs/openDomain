---
type: bounded_context
id: opendomain
name: OpenDomain
status: accepted
compatibility_note: Evidence references moved to public product artifacts; semantic meaning is unchanged.
owners:
  - opendomain-maintainer
evidence:
  - type: spec
    location: README.md
    summary: The public product definition describes OpenDomain as a Git-native, evidence-backed domain semantic layer.
    confidence: high
  - type: human_review
    location: conversation:2026-07-03-dogfood-opendomain-self-model
    summary: Human maintainer agreed OpenDomain should dogfood its own domain model.
    confidence: high
review:
  state: accepted
  reviewed_by: human-maintainer
  reviewed_at: 2026-07-03
---

# OpenDomain

OpenDomain is the bounded context for the product's own domain semantic model.

## Scope

This context owns the long-lived semantics of OpenDomain itself: domain
knowledge, concepts, rules, candidates, grounding packs, evidence, review state,
and derived retrieval views.
