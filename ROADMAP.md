# OpenDomain Roadmap

OpenDomain is an early alpha Git-native domain semantic layer for AI agents and
human maintainers.

## Current MVP Slices

- Markdown + YAML front matter source files
- Parser and validator
- CLI validation, ID listing, reference checks, grounding, and demo commands
- OpenSpec `affects_domain` grounding
- Domain Candidate boundary checks
- Semantic Retrieval Index as a derived read-first view
- OpenDomain self-model dogfooding under `opendomain/`

## Near-Term Work

1. Candidate review commands
   - `opendomain candidate list`
   - `opendomain candidate show <id>`
   - stale Candidate review support

2. Codex grounding CI
   - check `affects_domain` references
   - check grounding report shape
   - keep CI honest about what it can and cannot prove

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
