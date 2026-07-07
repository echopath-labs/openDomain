---
type: feature_spec
id: spec.opendomain-self-model-maintenance
name: OpenDomain self-model maintenance
status: proposed
affects_domain:
  concepts:
    - opendomain.domain-knowledge
    - opendomain.domain-candidate
    - opendomain.grounding-pack
  rules:
    - opendomain.accepted-knowledge-requires-human-review
    - opendomain.ai-inference-must-start-as-candidate
    - opendomain.candidate-is-not-accepted-knowledge
    - opendomain.codex-must-prepare-domain-grounding
    - opendomain.openspec-references-opendomain-not-duplicate
    - opendomain.index-is-derived-view-not-source-of-truth
    - opendomain.codex-readable-entrypoints-must-be-structured
  lifecycles:
    - opendomain.candidate-review-lifecycle
  events:
    - opendomain.grounding-prepared
---

# OpenDomain Self-Model Maintenance

This feature spec represents maintenance work on OpenDomain's own domain model.

## Intent

Codex should use OpenDomain to understand OpenDomain before changing its
domain-modeling workflow.

## Domain Grounding

Before modifying OpenDomain's self model, Codex should run:

```bash
npm run opendomain -- prepare domain/openspec/changes/self-model-maintenance/spec.md
```

Then read the accepted self-model files listed under `Read first`.

## Candidate Boundary

`candidate-0002-semantic-retrieval-index` remains proposed knowledge. It may
guide future design, but it is not accepted OpenDomain semantics yet.
