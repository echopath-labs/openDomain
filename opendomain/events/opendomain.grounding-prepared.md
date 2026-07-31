---
type: domain_event
id: opendomain.grounding-prepared
name: Grounding Prepared
context: opendomain
status: accepted
compatibility_note: Evidence references moved to public product artifacts; semantic meaning is unchanged.
past_tense_name: GroundingPrepared
occurs_when: Codex or a tool generates a Domain Grounding Pack for a feature spec.
applies_to:
  - opendomain.grounding-pack
evidence:
  - type: spec
    location: schemas/grounding-pack.schema.json
    summary: The public Grounding Pack contract represents the output produced by grounding preparation.
    confidence: high
  - type: test
    location: tests/protocol.test.mjs
    summary: Grounding protocol tests verify successful and failed preparation behavior.
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
