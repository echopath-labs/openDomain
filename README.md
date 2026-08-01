# OpenDomain

[![CI](https://github.com/echopath-labs/openDomain/actions/workflows/ci.yml/badge.svg)](https://github.com/echopath-labs/openDomain/actions/workflows/ci.yml)
![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)
![Status](https://img.shields.io/badge/status-alpha-f59e0b.svg)
![Node](https://img.shields.io/badge/node-%3E%3D20-0f766e.svg)
![Source](https://img.shields.io/badge/source-Markdown%20%2B%20YAML-2563eb.svg)

> 简体中文说明: [README.zh-CN.md](README.zh-CN.md)

OpenDomain is a Git-native, evidence-backed, AI-maintainable domain semantic
layer for software systems.

It helps AI agents and human maintainers preserve long-lived business knowledge:
what a business concept means, what it is not, which rules and lifecycles govern
it, which evidence supports it, and which changes require human review.

## Boundary

OpenDomain, OpenSpec, and EchoPath are separate layers:

```text
OpenDomain
  Stable business semantics
  What the business world is and which rules remain true over time

OpenSpec
  Change intent and delivery specification
  Why a change exists, what must be delivered, and how it is accepted

EchoPath
  Agent execution continuity
  How agents recover, hand off, preserve context, and propose memory
```

OpenDomain should be referenced by OpenSpec, not copied into OpenSpec.

## Current Capabilities

This workspace now includes the first MVP slices:

- Markdown + YAML front matter source files
- Safe parser and Draft 2020-12 runtime schema validation
- Safe-corpus gating before semantic closure, indexes, and grounding
- CLI commands for project init, validation, ID listing, reference checks,
  grounding, indexing, and demo
- OpenSpec `affects_domain` grounding
- Explicit `required`, `not_required`, and `unclassified` grounding decisions
- Advisory and enforced Grounding Assurance for Codex and CI
- Declarative repository-local Integration Profiles for structured non-OpenSpec
  sources, with Native Mapping and Sidecar Domain Declaration
- Deterministic file or bundle Source Units and explicit or automatic Profile
  selection
- Domain Candidate boundary checks
- Semantic Retrieval Index as a derived read-first view
- Deterministic workspace resolution with canonical `opendomain/` sources
- OpenDomain dogfooding under `opendomain/`

The source of truth remains Markdown with YAML front matter stored in Git.

## Usage

Install the CLI from npm:

```bash
npm install -g @echopath-labs/opendomain
opendomain init
opendomain validate
```

Or try it from a source checkout:

Common commands:

```bash
npm run opendomain -- help
npm run opendomain -- init
npm run opendomain -- validate
npm run prepare:demo
npm run opendomain -- assure examples/erp/openspec/changes/order-cancellation/spec.md
npm run opendomain -- integrations validate
npm run opendomain -- integrations list
npm run opendomain -- candidate list examples/erp
npm run opendomain -- candidate show candidate-0001-order-lifecycle examples/erp
npm run opendomain -- index build examples/erp --out /tmp/erp-index.json
npm run opendomain -- index query sales.order --index /tmp/erp-index.json
npm test
```

Commands without a source path resolve the current project's canonical
`opendomain/` workspace. During `0.x`, a legacy `domain/` workspace remains
readable when the canonical root is absent. If both exist, `opendomain/` wins
with a warning; the roots are never merged. Pass a file or directory explicitly
when validating a fixture or external corpus such as `examples/erp`.

An OpenSpec-style source unit can declare an explicit grounding decision:

```yaml
grounding:
  status: required
  rationale: Cancellation is constrained by accepted order semantics.
affects_domain:
  concepts:
    - sales.order
  rules: []
  lifecycles: []
  events: []
```

The supported statuses are `required`, `not_required`, and `unclassified`.
`not_required` requires a non-whitespace rationale and forbids every OpenDomain
ID. Empty IDs under `required` represent an incomplete `domain_model_gap`;
empty IDs never imply `not_required`.
Every affected ID must also match its declared category: `concepts` resolve to
`domain_concept`, `rules` to `business_rule`, `lifecycles` to `lifecycle`, and
`events` to `domain_event`. IDs must contain non-whitespace text. When a
`feature_spec` is included in an `opendomain validate` target, validation applies
the same grounding-decision rules used by `prepare` and `assure`.
Unknown affected-domain categories are invalid. A source recognized as OpenSpec
but failing validation does not fall through to a matching Profile, and external
Grounding Packs cannot contain duplicate evidence or Candidate IDs.

Run the read-only preflight locally or in CI:

```bash
opendomain assure <source-unit>
opendomain assure <source-unit> --mode enforced --json
```

Advisory mode warns but exits zero for `unclassified` and `domain_model_gap`.
Enforced mode fails those incomplete states. Malformed input, contradictions,
broken references, integration ambiguity, and accepted/Candidate trust boundary
violations fail in both modes. Run `opendomain init` before adopting Assurance
in an existing project. The result reports observed evidence; it does not prove
Agent comprehension or independently attest a historical repository state.
An `unclassified` request still validates every affected ID it already declares;
missing or mistyped evidence fails in both modes rather than becoming advisory.
The Result Schema binds `prepared` to `required`, `not_required` to an explicit
evidence-free skip, and `incomplete` to `required` or `unclassified`.
It validates shape and expressible local invariants, including that `pass`
contains no findings or Pack diagnostics and that `warn` contains no error
findings or Pack errors. It does not re-evaluate semantic coverage in persisted
or third-party JSON; CI must run `opendomain assure` against the current
workspace.
Affected concepts, rules, lifecycles, and events use the same canonical dotted
ID grammar as their OpenDomain source objects. Grounding Pack evidence IDs are
validated against the grammar for their declared type.
`read_first` accepts only bounded contexts, concepts, rules, lifecycles, and
events, and every evidence path must contain non-whitespace text;
`domain_candidate` entries remain confined to Candidate boundaries.
Paths rendered by Assurance are normalized single-line values without leading
or trailing whitespace or terminal control characters. Evidence and Candidate
paths must also be normalized repository-relative paths without absolute roots,
backslashes, or `.` / `..` traversal segments. External diagnostic text uses the
same control-character boundary, and schema-derived finding text escapes unsafe
property-name controls before terminal output.
Caller-supplied or persisted Grounding Packs cannot establish completed
Assurance, even when their shape is valid. Run `opendomain assure` against the
current Source Unit and workspace so accepted evidence and Semantic Closure are
regenerated from validated OpenDomain sources.
`preparation` reports only its state. The Grounding Request and classification
live in `grounding_pack.grounding_request`; evidence IDs, types, and paths live
in `grounding_pack.read_first` and `grounding_pack.candidate_boundaries`. IDs
cannot appear in both evidence collections, and the Result carries no divergent
request, classification, or evidence summary.
Each Candidate boundary uses the Candidate ID, lifecycle status, and confidence
contract, and its `target_id` must identify accepted `read_first` evidence in
that same Pack. Human-readable Assurance output preserves that review status,
including final `rejected`, `superseded`, or `deprecated` decisions.

Repository-local Integration Profiles can normalize explicit structured intent
and OpenDomain IDs from non-OpenSpec sources. Profiles do not scan prose, infer
IDs, execute code, create Candidates, or promote accepted knowledge. The
machine-readable contracts are published under `schemas/`.
Profile v1 has no grounding-decision mapping, so its trusted Request Builder
normalizes requests to `unclassified`; use advisory Assurance, or an integration
with an explicit decision, until that contract is extended.

## Project Status

OpenDomain is early alpha. The current repository is ready for public iteration,
but the format and CLI may still change.

Public entry points:

- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [Changelog](CHANGELOG.md)
- `schemas/` for machine-readable contracts
- `examples/erp/` for synthetic integration fixtures

License: MIT.

## Repository Map

```text
.
├── README.md
├── opendomain/
│   ├── integrations/profiles/
│   └── README.md
├── examples/
│   └── erp/
├── schemas/
└── tests/
```

## Working Rule

AI-discovered domain knowledge starts as a Candidate. It does not become
accepted OpenDomain knowledge until a human reviewer approves it.

## MVP Grounding Demo

The first MVP slice demonstrates Order Cancellation grounding:

```bash
npm test
npm run prepare:demo
npm run opendomain -- validate examples/erp
npm run demo
```

## Semantic Retrieval Index

The index is a derived read-first view. It helps Codex find accepted source
files and related Candidate boundaries, but it is not source of truth.

## Dogfooding

OpenDomain now models part of its own product semantics under `opendomain/`.

```bash
npm run opendomain -- validate
```

## Planning Split

Use this rule when preserving planning:

- `opendomain/`: long-lived OpenDomain semantics
- `opendomain/candidates/`: proposed or inferred semantics
- a project's optional `openspec/changes/`: future delivery work

Maintainer OpenSpec, PRDs, ADRs, dogfooding, review notes, roadmaps, and release
procedures are development-process records. They are intentionally excluded
from this public repository and from the npm package. The OpenSpec files under
`examples/erp/` are synthetic interoperability fixtures, not project records.
