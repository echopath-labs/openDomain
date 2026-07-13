# ADR-0002: Versioned Minimal Grounding Protocol

## Status

Accepted

## Context

The current `prepare --json` shape mixes tool-neutral grounding data with
OpenSpec feature fields, integration selection details, and derived display
guidance. Freezing the entire alpha response would make external tool formats
and Profile Runtime internals part of OpenDomain's public compatibility burden.

## Decision

Grounding Protocol is the only stable core integration contract. Grounding
Request and Grounding Pack will expose an explicit `protocol_version`, and only
their documented minimal field sets receive compatibility guarantees.

OpenSpec-specific feature output, Profile Runtime details, display names, and
derived semantic guidance are optional metadata. Existing alpha fields may be
retained as compatibility output until an explicitly documented breaking
release.

## Consequences

- Producers and consumers can integrate without adopting OpenSpec concepts.
- External tool format changes remain Profile Runtime concerns.
- Stable field changes require protocol compatibility review.
- Convenience metadata can evolve without redefining the core contract.
