---
type: domain_concept
id: opendomain.domain-knowledge
name: Domain Knowledge
context: opendomain
status: accepted
version: 1
compatibility_note: Evidence references moved to public product artifacts; semantic meaning and version are unchanged.
aliases:
  - Business Knowledge
  - Domain Semantics
not_synonyms:
  - Feature Requirement
  - Agent Session Memory
owners:
  - opendomain-maintainer
related:
  - type: represented_by
    target: opendomain.domain-concept
  - type: constrained_by
    target: opendomain.business-rule
  - type: proposed_through
    target: opendomain.domain-candidate
rules:
  - opendomain.accepted-knowledge-requires-human-review
  - opendomain.ai-inference-must-start-as-candidate
  - opendomain.openspec-references-opendomain-not-duplicate
  - opendomain.index-is-derived-view-not-source-of-truth
  - opendomain.codex-readable-entrypoints-must-be-structured
lifecycles: []
events: []
evidence:
  - type: spec
    location: README.md
    summary: The public boundary separates stable domain knowledge from change intent and Agent continuity.
    confidence: high
  - type: spec
    location: schemas/opendomain.schema.json
    summary: The public schema registry defines the supported domain semantic source types.
    confidence: high
review:
  state: accepted
  reviewed_by: human-maintainer
  reviewed_at: 2026-07-03
---

# Domain Knowledge

Domain Knowledge is long-lived knowledge about a business or product domain
that should remain useful after the current feature ends.

It should be structured so Codex can locate the relevant accepted source files
without scanning the entire repository or relying on unreviewed memory.

## Not This

- Domain Knowledge is not a one-time feature requirement.
- Domain Knowledge is not raw Agent session memory.
- Domain Knowledge is not a database schema copied into Markdown.
