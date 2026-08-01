---
type: business_rule
id: opendomain.candidate-is-not-accepted-knowledge
name: Candidate is not accepted knowledge
context: opendomain
status: accepted
compatibility_note: Evidence references moved to public product artifacts; semantic meaning is unchanged.
applies_to:
  - opendomain.domain-candidate
severity: must
rule_type: invariant
evidence:
  - type: spec
    location: schemas/candidate.schema.json
    summary: Domain Candidate status cannot be accepted and remains separate from accepted source schemas.
    confidence: high
  - type: spec
    location: schemas/grounding-pack.schema.json
    summary: Grounding Pack exposes Candidates through a separate candidate_boundaries collection.
    confidence: high
review:
  state: accepted
  reviewed_by: human-maintainer
  reviewed_at: 2026-07-03
---

# Candidate Is Not Accepted Knowledge

A Domain Candidate is not a trusted source of accepted OpenDomain truth.

It may guide review and investigation, but Agent grounding must report it as
proposed knowledge until a human accepts it.
