# ADR-0006: OpenDomain Workspace Layout

## Status

Accepted

## Context

OpenDomain needs one recognizable workspace for semantic sources, integration
configuration, Candidates, and generated retrieval output. Extra nesting makes
the Agent reading path longer without adding a meaningful boundary.

## Decision

The canonical workspace uses direct semantic directories:

```text
opendomain/
  README.md
  config.yaml
  contexts/
  concepts/
  rules/
  lifecycles/
  events/
  candidates/
  integrations/profiles/
  generated/index.json
```

`generated/` is derived and rebuildable. OpenDomain uses freshness signals to
preserve that boundary but does not decide whether users track or ignore the
files.

## Consequences

- Agents have one short, predictable workspace entrypoint.
- Existing `domain/` and `.opendomain/` paths require migration support.
- Generated output is colocated with the product workspace but remains
  non-authoritative.
