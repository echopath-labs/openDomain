# Dogfooding OpenDomain With OpenDomain

OpenDomain should use its own format to model its own long-lived product
semantics.

This is the first real `opendomain/` model in the repository. The ERP files under
`examples/` remain examples; the OpenDomain self model under `opendomain/` is
actual project knowledge.

## Boundary

Use the repository layers this way:

- `opendomain/`: long-lived OpenDomain product semantics
- `opendomain/candidates/`: proposed OpenDomain semantics awaiting human review
- a maintainer's private `openspec/changes/`: change intent, design, tasks, and acceptance
- `docs/`: PRD, architecture, and development guidance
- `examples/`: external example domains

## Current Self Model

Accepted self-model context:

- `opendomain`

Accepted self-model concepts:

- `opendomain.domain-knowledge`
- `opendomain.domain-concept`
- `opendomain.business-rule`
- `opendomain.domain-candidate`
- `opendomain.grounding-pack`

Accepted self-model rules:

- `opendomain.accepted-knowledge-requires-human-review`
- `opendomain.ai-inference-must-start-as-candidate`
- `opendomain.candidate-is-not-accepted-knowledge`
- `opendomain.codex-must-prepare-domain-grounding`
- `opendomain.openspec-references-opendomain-not-duplicate`
- `opendomain.index-is-derived-view-not-source-of-truth`
- `opendomain.codex-readable-entrypoints-must-be-structured`

Accepted lifecycle and event:

- `opendomain.candidate-review-lifecycle`
- `opendomain.grounding-prepared`

Proposed self-model Candidate:

- `candidate-0002-semantic-retrieval-index`

## Planning Classification

Use this split when preserving planning output:

- Put stable OpenDomain semantics in `opendomain/`.
- Put uncertain inferred semantics in `opendomain/candidates/`.
- Put delivery plans in a private planning workspace such as `openspec/changes/`.
- Put explanatory narrative in `docs/`.

Do not turn future implementation plans into accepted OpenDomain knowledge. For
example, `Semantic Retrieval Index should exist as a derived view` can be a
Candidate or accepted rule depending on review state, while `implement
opendomain index build/query` belongs in OpenSpec.

## Codex Readability

OpenDomain self-model files should be easy for Codex to consume through a
stable entrypoint. The intended path is: prepare or query, read the small set of
accepted source files, then inspect evidence or Candidates only when needed.

This is now accepted self-model knowledge through:

- `opendomain.codex-readable-entrypoints-must-be-structured`

## Prepare The Self Model

Before changing OpenDomain's own domain semantics, run:

```bash
npm run opendomain -- prepare examples/self-model/openspec/changes/self-model-maintenance/spec.md
```

This returns the accepted OpenDomain files to read first and the Candidate
boundary for the proposed Semantic Retrieval Index.

## Validation

Validate real OpenDomain self-model files:

```bash
npm run opendomain -- validate
```

Run all tests:

```bash
npm test
```

## Rule

Dogfooding does not relax governance. Inferred OpenDomain semantics still start
as Candidates unless the human maintainer explicitly accepts them.
