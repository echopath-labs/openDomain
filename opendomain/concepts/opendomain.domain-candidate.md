---
type: domain_concept
id: opendomain.domain-candidate
name: Domain Candidate
context: opendomain
status: accepted
version: 1
compatibility_note: Evidence references moved to public product artifacts; semantic meaning and version are unchanged.
aliases:
  - Candidate
not_synonyms:
  - Accepted Knowledge
owners:
  - opendomain-maintainer
related:
  - type: proposes_change_to
    target: opendomain.domain-knowledge
rules:
  - opendomain.ai-inference-must-start-as-candidate
  - opendomain.candidate-is-not-accepted-knowledge
lifecycles:
  - opendomain.candidate-review-lifecycle
events: []
evidence:
  - type: spec
    location: schemas/candidate.schema.json
    summary: The public Candidate schema requires proposed change, evidence, confidence, and review metadata.
    confidence: high
  - type: code
    location: src/candidates.mjs
    summary: Candidate commands preserve proposed knowledge separately from accepted OpenDomain files.
    confidence: high
review:
  state: accepted
  reviewed_by: human-maintainer
  reviewed_at: 2026-07-03
---

# Domain Candidate

A Domain Candidate is proposed domain knowledge awaiting human review.

It may contain useful evidence and reasoning, but it is not accepted truth until
a human reviewer accepts the knowledge and it is promoted into an accepted
OpenDomain file.
