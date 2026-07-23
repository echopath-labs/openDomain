# ADR-0007: Non-Destructive Workspace Migration

## Status

Accepted

## Context

Earlier OpenDomain alpha releases used `domain/` for semantic sources and
`.opendomain/index.json` for a generated index. Moving to canonical
`opendomain/` must not make existing knowledge disappear or let tooling delete
or overwrite user files.

## Decision

Throughout `0.x`, OpenDomain falls back to legacy `domain/` when canonical
`opendomain/` is absent. If both roots exist, canonical `opendomain/` wins with
an explicit warning.

The current version provides discovery fallback only; it does not expose an
automatic migration command. If a migration command is introduced later, it
must copy and validate source files and Candidates without overwriting targets,
deleting legacy content, changing Git state, or editing ignore rules. Legacy
generated indexes must be rebuilt rather than copied. Legacy discovery may only
be removed in `1.0` with documented migration guidance.

## Consequences

- Existing alpha users retain access to their business model.
- Migration remains reversible because legacy files are preserved.
- Dual roots are deterministic but produce a visible warning.
- The CLI carries a legacy discovery path until `1.0`.
- Maintainers perform the current source move manually and review the Git diff.
