---
type: domain_event
id: opendomain.grounding-prepared
name: Grounding Prepared
context: opendomain
status: accepted
past_tense_name: GroundingPrepared
occurs_when: Codex or a tool generates a Domain Grounding Pack for a feature spec.
applies_to:
  - opendomain.grounding-pack
evidence:
  - type: spec
    location: docs/mvp-grounding-demo.md
    summary: The MVP grounding demo defines preparing a grounding pack before feature work.
    confidence: high
  - type: spec
    location: AGENTS.md
    summary: Repository instructions require Codex to run opendomain prepare before non-trivial feature work.
    confidence: high
review:
  state: accepted
  reviewed_by: human-maintainer
  reviewed_at: 2026-07-03
---

# Grounding Prepared

Grounding Prepared is the event that a task-scoped Domain Grounding Pack has
been generated for a feature spec.

It records the business fact that Agent grounding has been prepared, not that
the implementation has been completed.
