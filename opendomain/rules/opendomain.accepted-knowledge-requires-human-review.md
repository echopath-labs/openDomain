---
type: business_rule
id: opendomain.accepted-knowledge-requires-human-review
name: Accepted knowledge requires human review
context: opendomain
status: accepted
compatibility_note: Evidence references moved to public product artifacts; semantic meaning is unchanged.
applies_to:
  - opendomain.domain-knowledge
  - opendomain.domain-concept
  - opendomain.business-rule
  - opendomain.domain-candidate
severity: must
rule_type: invariant
evidence:
  - type: spec
    location: schemas/concept.schema.json
    summary: Accepted concepts require evidence and accepted human review metadata.
    confidence: high
  - type: test
    location: tests/validator.test.mjs
    summary: Validator tests reject accepted knowledge without review metadata.
    confidence: high
review:
  state: accepted
  reviewed_by: human-maintainer
  reviewed_at: 2026-07-03
---

# Accepted Knowledge Requires Human Review

OpenDomain knowledge with `status: accepted` must include evidence and human
review metadata.

## Agent Guidance

Do not promote inferred knowledge to accepted state without explicit human
review.
