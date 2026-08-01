---
type: business_rule
id: opendomain.openspec-references-opendomain-not-duplicate
name: OpenSpec references OpenDomain, not duplicates it
context: opendomain
status: accepted
compatibility_note: Evidence references moved to public product artifacts; semantic meaning is unchanged.
applies_to:
  - opendomain.domain-knowledge
severity: must
rule_type: invariant
evidence:
  - type: spec
    location: README.md
    summary: The public product boundary requires OpenSpec to reference rather than copy OpenDomain definitions.
    confidence: high
  - type: spec
    location: examples/erp/openspec/changes/order-cancellation/spec.md
    summary: The synthetic OpenSpec fixture references accepted OpenDomain IDs through affects_domain.
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
