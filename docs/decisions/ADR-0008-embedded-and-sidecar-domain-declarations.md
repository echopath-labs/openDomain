# ADR-0008: Embedded And Sidecar Domain Declarations

## Status

Superseded by ADR-0009

## Context

Some planning tools allow structured OpenDomain references inside their native
artifacts, while others should remain unmodified. Parsing ordinary prose would
cross from format normalization into semantic inference.

## Decision

OpenDomain supports Embedded and Sidecar Domain Declarations through one shared
schema. Embedded mode uses YAML front matter or an explicit `opendomain` fenced
block. Sidecar mode uses a neighboring `opendomain.yaml`.

Each Integration Profile selects exactly one mode for one input. If both are
present, Profile Runtime fails with an ambiguity diagnostic and does not merge
or choose an implicit winner.

## Consequences

- Customizable tools can keep declarations inside their artifacts.
- Locked or externally owned artifacts can use sidecars.
- Both modes normalize through one validation contract.
- Users must resolve duplicate declarations explicitly.

## Supersession Note

ADR-0009 clarifies that Embedded and Sidecar are Domain Declaration transports,
while Native Mapping is a separate reference acquisition mode that adapts an
external tool's own schema.
