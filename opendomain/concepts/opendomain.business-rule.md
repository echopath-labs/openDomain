---
type: domain_concept
id: opendomain.business-rule
name: Business Rule
context: opendomain
status: accepted
version: 1
compatibility_note: Evidence references moved to public product artifacts; semantic meaning and version are unchanged.
aliases:
  - Domain Rule
  - Invariant
not_synonyms:
  - Implementation Detail
  - Test Case
owners:
  - opendomain-maintainer
related:
  - type: constrains
    target: opendomain.domain-knowledge
rules:
  - opendomain.accepted-knowledge-requires-human-review
lifecycles: []
events: []
evidence:
  - type: spec
    location: schemas/rule.schema.json
    summary: The public rule schema defines the structured Business Rule contract.
    confidence: high
review:
  state: accepted
  reviewed_by: human-maintainer
  reviewed_at: 2026-07-03
---

# Business Rule

A Business Rule is a long-lived invariant, policy, constraint, definition, or
exception that Agents should respect when changing software.
