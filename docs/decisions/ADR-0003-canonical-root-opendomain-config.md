# ADR-0003: Canonical Root OpenDomain Configuration

## Status

Superseded by ADR-0005

## Context

Profile Runtime needs a repository-local configuration source. The existing
`.opendomain/` directory is ignored by Git and stores rebuildable derived output
such as the semantic index. Tool-specific front matter is input data, not the
owner of OpenDomain integration configuration.

## Decision

Root-level `opendomain.config.yaml` is the single canonical, Git-tracked Profile
Runtime configuration entrypoint. The MVP supports one file. Future profile
files may only be introduced through explicit references from this root file.

## Consequences

- Maintainers and agents can discover configuration without scanning hidden
  directories.
- Removing `.opendomain/` cannot remove canonical configuration.
- External tools carry domain references without owning OpenDomain mappings.
- The repository root gains one visible configuration file.

## Supersession Note

The maintainer withdrew this decision on 2026-07-10 after distinguishing a
user-facing OpenDomain workspace from a standalone root configuration file.
ADR-0005 replaces the standalone root file with a canonical `opendomain/`
workspace and keeps version-control tracking policy under user control.
