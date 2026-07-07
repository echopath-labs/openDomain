---
type: domain_candidate
id: candidate-0002-semantic-retrieval-index
status: proposed
proposed_change_type: update_concept
target:
  type: domain_concept
  id: opendomain.domain-knowledge
confidence: medium
extracted_by: codex
extracted_at: 2026-07-03
evidence:
  - type: spec
    location: docs/product-prd.md
    summary: Derived views and indexes are planned as retrieval layers, not source of truth.
    confidence: medium
  - type: spec
    location: docs/architecture.md
    summary: Derived graph, index, search, MCP, or export views must be rebuildable from OpenDomain Git files.
    confidence: high
  - type: human_review
    location: conversation:2026-07-03-semantic-retrieval-index
    summary: Human maintainer agreed OpenDomain should have an index mechanism for token savings and long-term retrieval.
    confidence: high
  - type: human_review
    location: conversation:2026-07-06-codex-readability
    summary: Human maintainer accepted Codex readability as a core design criterion for retrieval and browsing design.
    confidence: high
possible_conflicts:
  - The exact index shape and commands are not accepted yet.
  - Persistent index files must not become source of truth.
review:
  state: proposed
  suggested_reviewer: opendomain-maintainer
---

# Candidate: Semantic Retrieval Index

Codex and the human maintainer discussed adding a Semantic Retrieval Index to
OpenDomain.

## Proposed Concept

`opendomain.semantic-retrieval-index` would be a derived retrieval layer that
helps Codex and humans find relevant accepted OpenDomain files without scanning
the full repository.

## Reasoning Summary

The index should help with:

- lowering token and context cost during current feature work
- finding relevant business models after long time gaps
- connecting concepts, rules, lifecycles, evidence, Candidates, and feature specs
- giving Codex a deterministic read-first path instead of requiring broad scans

## Boundary

The index must not become source of truth. It should be rebuildable from
OpenDomain files in Git.

The index should answer what Codex should read first. It should not answer final
domain truth without pointing back to accepted source files.

## Proposed Fields

The first index shape may include:

- `id`
- `type`
- `name`
- `context`
- `status`
- `source_file`
- `summary`
- `aliases`
- `rules`
- `lifecycles`
- `events`
- `relationships`
- `evidence`
- `review`
- `related_candidates`
- `referencing_feature_specs`
- `source_hash`
- `last_indexed_at`

## Proposed Query Result Shape

The first query result should be a read plan, not a replacement domain model:

- `read_first`: accepted source files to open
- `accepted_ids`: accepted concepts, rules, lifecycles, events, and contexts
- `candidate_boundaries`: proposed Candidates to treat as unaccepted
- `verify_with`: evidence or review metadata to inspect when claims matter

## Proposed Commands

The first commands may be:

```bash
opendomain index build
opendomain index query <domain-id>
opendomain index query --context <context-id>
```

## Non Goals

- The index must not store accepted facts that are absent from source files.
- The index must not replace `opendomain prepare`.
- The index must not require a graph database in the MVP.

## Requested Human Review

Please confirm the accepted concept shape, minimal fields, and first CLI
commands before promoting this into accepted OpenDomain knowledge.
