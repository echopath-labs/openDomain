# OpenDomain Roadmap

OpenDomain is an early alpha Git-native domain semantic layer for AI agents and
human maintainers.

## Current MVP Slices

- Markdown + YAML front matter source files
- Parser and validator
- CLI initialization, validation, Candidate review, indexing, grounding, and
  integration inspection commands
- OpenSpec `affects_domain` grounding
- Declarative Integration Profile v1 with file and bundle Source Units, Native
  Mapping, and Sidecar Domain Declaration
- Domain Candidate boundary checks
- Semantic Retrieval Index as a derived read-first view
- Deterministic canonical and legacy workspace resolution
- OpenDomain self-model dogfooding under `opendomain/`

## Near-Term Work

1. Codex grounding CI
   - check `affects_domain` references
   - check grounding report shape
   - keep CI honest about what it can and cannot prove

2. Integration consumer conformance
   - validate Profile-generated Grounding Requests across external tools
   - define EchoPath handoff and recovery consumption without protocol coupling
   - add tool-specific examples only after the generic Profile contract holds

3. OpenSpec archive and long-term recall
   - preserve change history
   - connect archived changes to current OpenDomain IDs
   - avoid turning one-off feature choices into domain truth

4. Format maturity
   - schema alignment
   - compatibility policy
   - migration guidance

## Non Goals For MVP

- Graph database as source of truth
- OWL/RDF/SPARQL as default authoring format
- SaaS collaboration platform
- automatic promotion of AI-inferred knowledge
- embedding search as the primary truth layer
