# ADR-0004: Deterministic Profile Normalization

## Status

Accepted

## Context

Profile Runtime should let repositories integrate different planning tools
without forcing them into one authoring format. Unbounded transforms would turn
profiles into executable programs and could silently infer domain semantics.

## Decision

Profile Runtime supports bounded declarative normalization of explicit,
structured source values into whitelisted Grounding Request fields. It may
read, rename, fall back, coerce, merge, and enum-map values deterministically.

It does not execute arbitrary code, parse unstructured prose with regular
expressions, invoke semantic inference, or invent OpenDomain IDs.

## Consequences

- Repositories can personalize format mappings without changing the core
  Grounding Protocol.
- Profiles remain statically validatable, portable, and reproducible.
- Complex deterministic tool integrations may require built-in adapters.
- Semantic discoveries continue through Candidate workflow.
