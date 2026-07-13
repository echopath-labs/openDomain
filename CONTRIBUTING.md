# Contributing to OpenDomain

OpenDomain is an early alpha project. Contributions should keep the core small,
Git-native, evidence-backed, and easy for AI agents to consume.

## Development Setup

Requirements:

- Node.js 20 or newer

Useful commands:

```bash
npm test
npm run opendomain -- validate
```

## Product Boundaries

Before changing OpenDomain, read:

- `docs/OPEN_DOMAIN_DEVELOPMENT_GUIDE.md`
- `docs/usage.md`

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
- Add or update tests for parser, validator, CLI, or index behavior changes.
- Update docs when commands, formats, or workflow expectations change.
- Do not commit generated `.opendomain/` indexes.

## Planning Artifacts

OpenSpec is supported as an integration source, but this public repository does
not require or publish the maintainer's private planning workspace. Public
builds, tests, and contributions must remain independent of private planning
artifacts.
