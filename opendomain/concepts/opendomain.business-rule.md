---
type: domain_concept
id: opendomain.business-rule
name: Business Rule
context: opendomain
status: accepted
version: 1
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
    location: docs/OPEN_DOMAIN_DEVELOPMENT_GUIDE.md
    summary: Business Rule is listed as a core object for invariants, policies, constraints, and exceptions.
    confidence: high
review:
  state: accepted
  reviewed_by: human-maintainer
  reviewed_at: 2026-07-03
---

# Business Rule

A Business Rule is a long-lived invariant, policy, constraint, definition, or
exception that Agents should respect when changing software.
