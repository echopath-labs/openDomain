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
- Domain Candidate boundary checks
- Semantic Retrieval Index as a derived read-first view
- OpenDomain dogfooding under `domain/`

The source of truth remains Markdown with YAML front matter stored in Git.

## Usage

Start with [docs/usage.md](docs/usage.md).

Install the CLI from npm:

```bash
npm install -g @echopath-labs/opendomain
opendomain init
opendomain validate domain
```

Or try it from a source checkout:

Common commands:

```bash
npm run opendomain -- help
npm run opendomain -- init
npm run opendomain -- validate
npm run opendomain -- prepare examples/erp/openspec/changes/order-cancellation/spec.md
npm run opendomain -- prepare --integration openspec examples/erp/openspec/changes/order-cancellation/spec.md
npm run opendomain -- candidate list examples/erp
npm run opendomain -- candidate show candidate-0001-order-lifecycle examples/erp
npm run opendomain -- index build examples/erp --out /tmp/erp-index.json
npm run opendomain -- index query sales.order --index /tmp/erp-index.json
npm test
```

## Project Status

OpenDomain is early alpha. The current repository is ready for public iteration,
but the format and CLI may still change.

Useful entry points:

- [Getting started](docs/getting-started.md)
- [Usage guide](docs/usage.md)
- [Grounding Protocol v1](docs/grounding-protocol.md)
- [Roadmap](ROADMAP.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [Changelog](CHANGELOG.md)

License: MIT.

## Repository Map

```text
.
├── README.md
├── docs/
│   ├── OPEN_DOMAIN_DEVELOPMENT_GUIDE.md
│   ├── getting-started.md
│   ├── vision.md
│   ├── glossary.md
│   ├── architecture.md
│   ├── grounding-protocol.md
│   ├── candidate-workflow.md
│   └── decisions/
├── domain/
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

See [docs/mvp-grounding-demo.md](docs/mvp-grounding-demo.md).

## Semantic Retrieval Index

The index is a derived read-first view. It helps Codex find accepted source
files and related Candidate boundaries, but it is not source of truth.

See [docs/semantic-retrieval-index.md](docs/semantic-retrieval-index.md).

## Dogfooding

OpenDomain now models part of its own product semantics under `domain/`.

```bash
npm run opendomain -- validate domain
npm run opendomain -- prepare domain/openspec/changes/self-model-maintenance/spec.md
```

See [docs/dogfooding-self-model.md](docs/dogfooding-self-model.md).

## Planning Split

Use this rule when preserving planning:

- `domain/`: long-lived OpenDomain semantics
- `domain/candidates/`: proposed or inferred semantics
- a project's optional `openspec/changes/`: future delivery work
- `docs/`: narrative explanation and product guidance
