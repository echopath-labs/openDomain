---
type: domain_concept
id: opendomain.grounding-pack
name: Grounding Pack
context: opendomain
status: accepted
version: 1
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
    location: docs/mvp-grounding-demo.md
    summary: The MVP grounding demo defines the Domain Grounding Pack as the Codex read-first output.
    confidence: high
  - type: spec
    location: AGENTS.md
    summary: Repository instructions require Codex to use opendomain prepare before non-trivial feature work.
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
