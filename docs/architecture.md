# OpenDomain Architecture

OpenDomain starts as a file-based semantic layer.

```text
Markdown + YAML front matter in Git
  ↓
Schema validation
  ↓
Parser and cross-reference validator
  ↓
CLI
  ↓
Candidate workflow
  ↓
OpenSpec reference checks
  ↓
Derived graph, index, search, MCP, or export views
```

## Source Of Truth

The source of truth is the set of OpenDomain files in Git:

- `domain/` for project domain knowledge
- `examples/` for illustrative fixtures
- `schemas/` for machine validation

Derived views are not authoritative. A graph export, search index, embedding
index, generated docs site, or MCP resource must be rebuildable from Git files.

The first derived retrieval view is documented in
`docs/semantic-retrieval-index.md`.

## Codex Readability

OpenDomain optimizes for a stable Codex reading path:

```text
OpenSpec affects_domain or code path hint
  ↓
Grounding Pack or derived retrieval index
  ↓
Small set of accepted OpenDomain source files
  ↓
Evidence and review metadata when claims matter
```

Readable for Codex means the entrypoint is deterministic, relationships are
explicit, and source files remain concise enough to read before implementation.
It does not mean moving accepted facts into an index. Indexes and other derived
views help Codex find files; OpenDomain Markdown files still decide truth.

## Planning Layers

OpenDomain uses three durable planning layers:

```text
OpenDomain
  Long-lived product or business semantics.
  If it remains true after the current feature ends, it may belong here.

OpenSpec
  Delivery intent, design, tasks, and acceptance criteria.
  If it explains why or how to deliver a change, it belongs here.

Docs
  Narrative product direction, architecture explanation, and operating guidance.
  Docs may be evidence for OpenDomain, but docs are not automatically accepted
  domain knowledge.
```

Examples:

- `Index is derived view, not source of truth` is OpenDomain.
- `Implement opendomain index build/query` is OpenSpec.
- `Why the index exists and how to use it` is docs.

## Object Model

The MVP object model contains:

- Bounded Context
- Domain Concept
- Relationship
- Lifecycle
- Business Rule
- Domain Event
- Evidence
- Domain Candidate
- Review State

## Review Boundary

Agents may discover, summarize, and propose knowledge. Agents must not silently
promote proposed knowledge to accepted knowledge.

Accepted knowledge requires evidence and human review metadata.

## OpenSpec Integration

OpenSpec may reference OpenDomain IDs through fields such as:

```yaml
affects_domain:
  concepts:
    - sales.order
  rules:
    - sales.confirmed-order-cannot-be-deleted
  lifecycles:
    - sales.order-lifecycle
```

OpenSpec should explain why a change exists and how to deliver it. OpenDomain
should explain what the business world means over time.

OpenSpec should reference OpenDomain through IDs. It should not copy concept,
rule, lifecycle, or event definitions into feature specs.
