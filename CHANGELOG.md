# Changelog

## Unreleased

## 0.1.0-alpha.8 - 2026-08-03

- Add Node SEA standalone CLI builds for macOS arm64/x64, Linux x64, and
  Windows x64 so projects can initialize OpenDomain without installing Node.js
  or adding package metadata.
- Add a shared packaged-resource boundary and exact CLI version reporting so
  npm and standalone channels use the same schemas, examples, and package
  version.
- Add native executable smoke coverage, deterministic SHA-256 manifests, and a
  least-privilege four-platform GitHub Actions release workflow.
- Refresh `minimatch`'s transitive `brace-expansion` dependency to the patched
  `5.0.9` release.
- Refresh Ajv's transitive `fast-uri` dependency to the patched `3.1.5`
  release.

## 0.1.0-alpha.7 - 2026-08-03

- Add explicit `required`, `not_required`, and `unclassified` Grounding Request
  decisions while preserving Grounding Protocol `1.0` compatibility.
- Add read-only `opendomain assure` with advisory and enforced policy modes,
  deterministic findings, brownfield model-gap handling, and a packaged result
  schema.
- Reject contradictory `not_required` domain references before Grounding Pack
  preparation can resolve or expose accepted evidence.
- Fail closed when an externally supplied Grounding Pack is schema-invalid or
  lacks accepted evidence for any declared affected ID.
- Normalize Integration Profile v1 requests to `unclassified` in the trusted
  Request Builder while rejecting external Packs that omit `grounding`.
- Reject whitespace-only skip rationales, sanitize external diagnostic codes,
  and enforce incomplete-state policy outcomes in the public Result Schema.
- Reject affected IDs whose accepted evidence type does not match the declared
  concepts, rules, lifecycles, or events category.
- Reject whitespace-only integration IDs, constrain Pack diagnostic severities,
  and share Grounding Request decision rules with repository validation.
- Preserve recognized OpenSpec errors during auto-selection, reject unknown
  affected-domain categories, and reject duplicate Pack evidence IDs.
- Bind Assurance preparation states to compatible grounding statuses and reject
  `not_required` Packs that carry grounding evidence.
- Restrict `read_first` to accepted semantic-closure types so Candidates cannot
  masquerade as accepted grounding evidence.
- Reject whitespace-only evidence paths and keep evidence IDs solely in the
  Grounding Pack instead of duplicating mutable summaries in Assurance Result.
- Reject IDs shared across accepted and Candidate evidence, and keep the
  Grounding Request and classification solely in the embedded Grounding Pack.
- Require Candidate boundaries to use the Candidate ID, status, and confidence
  contract and to target accepted evidence in the same Grounding Pack.
- Reject `pass` Results that carry findings or Pack diagnostics, and clarify
  that semantic coverage requires a fresh Assurance run rather than Schema-only
  validation of persisted or third-party JSON.
- Enforce canonical dotted IDs for affected domain objects and type-specific IDs
  for accepted evidence, and preserve each Candidate review status in text output.
- Validate declared evidence before applying `unclassified` policy so unresolved
  or mistyped affected IDs fail in both advisory and enforced modes.
- Reject leading/trailing whitespace, line breaks, and terminal control
  characters in Pack paths and diagnostic text, and escape schema-derived field
  names before rendering Assurance text.
- Require accepted and Candidate evidence paths to be normalized,
  repository-relative paths without traversal or platform-specific roots.
- Treat caller-supplied Grounding Packs as unverified input that cannot produce
  completed Assurance; regenerate from the current Source Unit and workspace.
- Reject `warn` Results that contain error findings or Pack errors, matching the
  runtime policy outcome.
- Keep maintainer OpenSpec and narrative development records outside the public
  repository and npm package; README and JSON Schemas remain the public usage
  and contract entrypoints.

## 0.1.0-alpha.6 - 2026-07-27

- Add repository-local declarative Integration Profile v1 for structured
  planning sources beyond the built-in OpenSpec adapter.
- Add safe file and bundle Source Units, Native Mapping, strict Sidecar Domain
  Declaration, and deterministic explicit or automatic adapter selection.
- Add `opendomain integrations list`, `opendomain integrations validate`, and
  `opendomain prepare --profile <id>`.
- Add Profile-aware initialization, ERP examples, package installation smoke
  coverage, and complete usage documentation.
- Upgrade `minimatch` to the patched v10 line and align supported Node.js
  releases to Node.js 20 or 22 and newer, with CI coverage for both LTS lines.
- Add a project-specific release runbook covering validation, npm dist-tags,
  registry smoke tests, GitHub releases, and rollback.

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
