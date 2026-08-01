---
type: domain_concept
id: opendomain.grounding-pack
name: Grounding Pack
context: opendomain
status: accepted
version: 1
compatibility_note: Evidence references moved to public product artifacts; semantic meaning and version are unchanged.
aliases:
  - Domain Grounding Pack
not_synonyms:
  - Source Of Truth
  - Full Domain Model
owners:
  - opendomain-maintainer
related:
  - type: selects
    target: opendomain.domain-knowledge
  - type: reports_boundary_for
    target: opendomain.domain-candidate
rules:
  - opendomain.codex-must-prepare-domain-grounding
  - opendomain.codex-readable-entrypoints-must-be-structured
lifecycles: []
events:
  - opendomain.grounding-prepared
evidence:
  - type: spec
    location: schemas/grounding-pack.schema.json
    summary: The public Grounding Pack schema defines accepted read-first evidence and separate Candidate boundaries.
    confidence: high
  - type: code
    location: src/prepare.mjs
    summary: The preparation pipeline derives a task-scoped Grounding Pack from validated OpenDomain sources.
    confidence: high
review:
  state: accepted
  reviewed_by: human-maintainer
  reviewed_at: 2026-07-03
---

# Grounding Pack

A Grounding Pack is a generated, task-scoped retrieval payload that tells Codex
which accepted OpenDomain files to read first and which related Candidates must
remain proposed.

It is not the source of truth. It is derived from OpenDomain files.

## Agent Guidance

A Grounding Pack should point Codex to the smallest useful set of accepted
source files and explicitly separate proposed Candidate boundaries from
accepted knowledge.
