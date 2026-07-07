---
type: business_rule
id: opendomain.openspec-references-opendomain-not-duplicate
name: OpenSpec references OpenDomain, not duplicates it
context: opendomain
status: accepted
applies_to:
  - opendomain.domain-knowledge
severity: must
rule_type: invariant
evidence:
  - type: spec
    location: docs/OPEN_DOMAIN_DEVELOPMENT_GUIDE.md
    summary: OpenSpec should reference OpenDomain rather than copy stable domain definitions.
    confidence: high
  - type: spec
    location: docs/architecture.md
    summary: OpenSpec may reference OpenDomain IDs and should explain why a change exists, while OpenDomain explains long-lived business meaning.
    confidence: high
  - type: spec
    location: docs/product-prd.md
    summary: PRD defines affects_domain as an OpenSpec reference convention and states OpenSpec does not duplicate OpenDomain definitions.
    confidence: high
review:
  state: accepted
  reviewed_by: human-maintainer
  reviewed_at: 2026-07-04
---

# OpenSpec References OpenDomain, Not Duplicates It

OpenSpec may reference accepted OpenDomain IDs to explain which domain semantics
a feature affects.

OpenSpec must not redefine the same concept, rule, lifecycle, or event as if it
were the source of truth.

## Agent Guidance

When implementing a feature, read OpenDomain files referenced by
`affects_domain`. Do not copy their definitions into OpenSpec.
