---
type: bounded_context
id: opendomain
name: OpenDomain
status: accepted
owners:
  - opendomain-maintainer
evidence:
  - type: spec
    location: docs/OPEN_DOMAIN_DEVELOPMENT_GUIDE.md
    summary: Defines OpenDomain as the Git-native, evidence-backed domain semantic layer.
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
