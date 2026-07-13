# Changelog

## Unreleased

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
