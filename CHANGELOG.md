# Changelog

## Unreleased

- Add repository-local declarative Integration Profile v1 for structured
  planning sources beyond the built-in OpenSpec adapter.
- Add safe file and bundle Source Units, Native Mapping, strict Sidecar Domain
  Declaration, and deterministic explicit or automatic adapter selection.
- Add `opendomain integrations list`, `opendomain integrations validate`, and
  `opendomain prepare --profile <id>`.
- Add Profile-aware initialization, ERP examples, package installation smoke
  coverage, and complete usage documentation.

## 0.1.0-alpha.5 - 2026-07-23

- Harden YAML front matter parsing with deterministic YAML 1.2 policy checks
  and safe semantic serialization.
- Reject ambiguous, prototype-sensitive, and non-JSON metadata before it enters
  validation, indexing, Semantic Closure, or grounding.
- Enforce packaged Draft 2020-12 source schemas before documents enter the
  validated corpus.
- Fail closed with deterministic diagnostics when the packaged schema registry
  is missing, malformed, or cannot be compiled.
- Install dependencies in CI before repository validation.

## 0.1.0-alpha.4 - 2026-07-14

- Add Grounding Protocol v1 request and pack fields with public JSON Schemas.
- Share deterministic Semantic Closure v1 between `prepare` and index queries.
- Add advisory required-versus-Candidate Context Budget estimates.
- Preserve existing OpenSpec alpha compatibility metadata.

## 0.1.0-alpha.3 - 2026-07-08

- Add `opendomain candidate list`, `candidate show`, and `candidate review`.
- Add Candidate final-review validation for reviewer, date, reason, and state alignment.
- Document Candidate review commands and the human-gated promotion boundary.
- Align English and Simplified Chinese README badges.

## 0.1.0-alpha.2 - 2026-07-08

- Add internal Grounding Request extraction for OpenSpec feature specs.
- Add explicit `opendomain prepare --integration openspec` support.
- Include Grounding Request metadata in JSON grounding output.

## 0.1.0-alpha.1 - 2026-07-08

- Add `opendomain init` for bootstrapping a minimal project structure.
- Add `opendomain init --example erp` for copying the bundled ERP example.
- Add first-use getting started documentation.

## 0.1.0-alpha

Initial alpha workspace for OpenDomain.

Included:

- Git-native Markdown + YAML front matter source format
- parser, validator, and CLI
- ERP Order Cancellation grounding demo
- Domain Candidate workflow boundary
- OpenSpec `affects_domain` grounding
- Semantic Retrieval Index read-first view
- OpenDomain self-model dogfooding
