# ADR-0001: Git Native Markdown First

## Status

Accepted

## Context

OpenDomain must be readable by humans, parseable by agents, diffable in Git, and
validatable in CI. The project should avoid starting with a heavy ontology
platform, graph database, or custom DSL.

## Decision

OpenDomain source files will use Markdown with YAML front matter as the initial
authoring format. JSON Schema files will define the initial machine-readable
constraints.

Git files are the source of truth. Graphs, indexes, search views, generated docs,
MCP resources, and export formats are derived outputs.

## Consequences

- Human review can happen through normal pull requests.
- Agents can parse stable metadata without scraping prose.
- The initial toolchain can stay small.
- Later export formats remain possible without making them the authoring format.
