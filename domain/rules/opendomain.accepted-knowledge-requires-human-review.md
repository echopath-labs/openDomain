---
type: business_rule
id: opendomain.accepted-knowledge-requires-human-review
name: Accepted knowledge requires human review
context: opendomain
status: accepted
applies_to:
  - opendomain.domain-knowledge
  - opendomain.domain-concept
  - opendomain.business-rule
  - opendomain.domain-candidate
severity: must
rule_type: invariant
evidence:
  - type: spec
    location: docs/OPEN_DOMAIN_DEVELOPMENT_GUIDE.md
    summary: Verified Domain Knowledge must be confirmed by humans.
    confidence: high
  - type: spec
    location: docs/product-prd.md
    summary: The PRD states AI can propose and human must accept.
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
