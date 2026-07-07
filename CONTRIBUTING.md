# Contributing to OpenDomain

OpenDomain is an early alpha project. Contributions should keep the core small,
Git-native, evidence-backed, and easy for AI agents to consume.

## Development Setup

Requirements:

- Node.js 20 or newer
- OpenSpec CLI when changing OpenSpec artifacts

Useful commands:

```bash
npm test
npm run opendomain -- validate
npm run openspec:validate
```

## Product Boundaries

Before changing OpenDomain, read:

- `docs/OPEN_DOMAIN_DEVELOPMENT_GUIDE.md`
- `docs/usage.md`
- `openspec/config.yaml`

Keep the layers separate:

- OpenDomain stores long-lived domain semantics.
- OpenSpec stores change intent, requirements, tasks, and acceptance.
- EchoPath stores agent execution continuity.

## Domain Knowledge Rules

- AI-discovered knowledge starts as a Domain Candidate.
- Accepted OpenDomain knowledge requires evidence and human review metadata.
- OpenSpec may reference OpenDomain IDs, but must not duplicate domain definitions.
- Derived indexes, graphs, and exports are not source of truth.

## Pull Request Checklist

- Run `npm test`.
- Run `npm run opendomain -- validate`.
- Run `npm run openspec:validate` after OpenSpec changes.
- Add or update tests for parser, validator, CLI, or index behavior changes.
- Update docs when commands, formats, or workflow expectations change.
- Do not commit generated `.opendomain/` indexes.

## OpenSpec Changes

Use OpenSpec changes for non-trivial product or workflow work. Keep tasks small
and check them off only after implementation and verification.
