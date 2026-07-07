---
type: domain_concept
id: opendomain.domain-concept
name: Domain Concept
context: opendomain
status: accepted
version: 1
aliases:
  - Concept
not_synonyms:
  - Database Table
  - Feature Spec
owners:
  - opendomain-maintainer
related:
  - type: represents
    target: opendomain.domain-knowledge
rules:
  - opendomain.accepted-knowledge-requires-human-review
lifecycles: []
events: []
evidence:
  - type: spec
    location: docs/OPEN_DOMAIN_DEVELOPMENT_GUIDE.md
    summary: Domain Concept is listed as an MVP core semantic object.
    confidence: high
review:
  state: accepted
  reviewed_by: human-maintainer
  reviewed_at: 2026-07-03
---

# Domain Concept

A Domain Concept is a stable named idea inside a bounded context.

It should explain what the concept means, what it is not, what rules and
lifecycles govern it, and what evidence supports it.
