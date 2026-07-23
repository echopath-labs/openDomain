---
type: business_rule
id: opendomain.candidate-is-not-accepted-knowledge
name: Candidate is not accepted knowledge
context: opendomain
status: accepted
applies_to:
  - opendomain.domain-candidate
severity: must
rule_type: invariant
evidence:
  - type: spec
    location: docs/product-prd.md
    summary: Candidate can safely carry AI-inferred knowledge but does not automatically become accepted.
    confidence: high
  - type: spec
    location: docs/mvp-grounding-demo.md
    summary: Candidate boundaries are proposed knowledge only.
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
