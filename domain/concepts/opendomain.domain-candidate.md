---
type: domain_concept
id: opendomain.domain-candidate
name: Domain Candidate
context: opendomain
status: accepted
version: 1
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
    location: docs/OPEN_DOMAIN_DEVELOPMENT_GUIDE.md
    summary: Domain Candidate is the default target for AI-discovered knowledge before human review.
    confidence: high
  - type: spec
    location: docs/candidate-workflow.md
    summary: Candidate workflow is the safety boundary between AI inference and accepted business knowledge.
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
