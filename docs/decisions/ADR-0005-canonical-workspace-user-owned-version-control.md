# ADR-0005: Canonical Workspace With User-Owned Version Control

## Status

Accepted

## Context

A standalone root configuration file does not provide a coherent product
workspace. At the same time, calling a workspace canonical must not imply that
OpenDomain controls whether its files are tracked or ignored by Git.

## Decision

`opendomain/` replaces `domain/` as the canonical workspace for OpenDomain
configuration and content. All OpenDomain-owned files remain plain-text,
diff-friendly, and suitable for Git or another version-control system.

Users own version-control policy. OpenDomain does not require a Git repository,
run `git add`, or prescribe which files must be tracked or ignored.

## Consequences

- Users get one product workspace analogous to `openspec/`.
- Canonical content authority is independent of Git index state.
- Existing `domain/` users need an alpha migration path.
- ADR-0006 defines the internal workspace tree and generated-output location.
