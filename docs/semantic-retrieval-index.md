# Semantic Retrieval Index

The Semantic Retrieval Index is a derived read-first layer for Codex and human
maintainers.

It helps locate relevant accepted OpenDomain files without scanning every
domain file in the repository. It is not source of truth.

## Commands

Build the default index:

```bash
npm run opendomain -- index build
```

Build an index for one domain tree:

```bash
npm run opendomain -- index build examples/erp --out /tmp/erp-index.json
```

Query a domain ID:

```bash
npm run opendomain -- index query sales.order --index /tmp/erp-index.json
```

Query a context:

```bash
npm run opendomain -- index query --context sales --index /tmp/erp-index.json
```

## JSON Shape

The generated index uses this top-level shape:

```json
{
  "schema": "opendomain.semantic-index.v1",
  "generated_at": "2026-07-07T00:00:00.000Z",
  "source_root": "examples/erp",
  "derived_from": "OpenDomain Markdown source files in Git",
  "authoritative_source": "OpenDomain source files, not this index",
  "entries": []
}
```

Each entry contains a compact, parseable view of one source file:

```json
{
  "id": "sales.order",
  "type": "domain_concept",
  "name": "Order",
  "context": "sales",
  "status": "accepted",
  "source_file": "examples/erp/domain/concepts/sales.order.md",
  "summary": "An Order represents a customer's commercial request...",
  "relationships": [],
  "rules": ["sales.confirmed-order-cannot-be-deleted"],
  "lifecycles": ["sales.order-lifecycle"],
  "events": ["sales.order-confirmed"],
  "referencing_feature_specs": ["spec.order-cancellation"],
  "evidence": [],
  "review": {},
  "source_hash": "sha256...",
  "last_indexed_at": "2026-07-07T00:00:00.000Z"
}
```

## Query Result

Queries return a read-first plan:

- `read_first`: accepted source files Codex should open
- `accepted_ids`: accepted OpenDomain IDs included in the plan
- `candidate_boundaries`: related proposed Candidates that are not accepted truth
- `verify_with`: evidence and review metadata to inspect when claims matter
- `warnings`: stale source-file warnings or other non-fatal issues

## Source-Of-Truth Boundary

The index can be deleted and rebuilt from OpenDomain Markdown files. Query
results point Codex to source files; they do not replace source files.

When a source file changes after index build, query emits a stale warning and
the index should be rebuilt.
