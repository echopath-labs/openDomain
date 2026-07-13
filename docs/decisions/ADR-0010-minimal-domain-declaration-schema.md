# ADR-0010: Minimal Domain Declaration Schema

## Status

Accepted

## Context

Domain Declaration exists to attach explicit domain scope to an external work
artifact. Adding source, intent, status, or free-form metadata would duplicate
the external specification and let the declaration grow into a second work
item format.

## Decision

Embedded and Sidecar Domain Declarations contain only `schema_version` and a
non-empty `affects_domain` object at the top level. The object may reference
concepts, rules, lifecycles, and events by stable OpenDomain ID.

Unknown top-level fields, copied domain definitions, source, intent, status,
integration configuration, and free-form metadata are rejected. Native Mapping
constructs Grounding Request input directly and does not create a Domain
Declaration.

## Consequences

- Domain Declaration remains a small domain-scope attachment.
- External tools remain the source of work-item intent.
- Embedded and Sidecar payloads share one strict validator.
- Future declaration fields require schema compatibility review.
