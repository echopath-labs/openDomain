---
type: lifecycle
id: opendomain.candidate-review-lifecycle
name: Candidate review lifecycle
context: opendomain
status: accepted
compatibility_note: Evidence references moved to public product artifacts; semantic meaning is unchanged.
applies_to:
  - opendomain.domain-candidate
states:
  - id: proposed
    name: Proposed
    terminal: false
  - id: stale
    name: Stale
    terminal: false
  - id: rejected
    name: Rejected
    terminal: true
  - id: superseded
    name: Superseded
    terminal: true
  - id: deprecated
    name: Deprecated
    terminal: true
transitions:
  - from: proposed
    to: stale
    trigger: stale_warning
  - from: proposed
    to: rejected
    trigger: reject_candidate
  - from: proposed
    to: superseded
    trigger: promote_or_replace_candidate
  - from: proposed
    to: deprecated
    trigger: deprecate_candidate
  - from: stale
    to: rejected
    trigger: reject_candidate
  - from: stale
    to: superseded
    trigger: promote_or_replace_candidate
  - from: stale
    to: deprecated
    trigger: deprecate_candidate
forbidden_transitions:
  - from: proposed
    to: proposed
    reason: Candidate review should either add evidence or move toward a decision, not create duplicate unchanged proposals.
related_rules:
  - opendomain.ai-inference-must-start-as-candidate
  - opendomain.candidate-is-not-accepted-knowledge
evidence:
  - type: spec
    location: schemas/candidate.schema.json
    summary: The public Candidate schema defines proposed and final review states.
    confidence: high
  - type: test
    location: tests/cli.test.mjs
    summary: Candidate CLI tests cover review decisions, stale warnings, and accepted-knowledge separation.
    confidence: high
review:
  state: accepted
  reviewed_by: human-maintainer
  reviewed_at: 2026-07-03
---

# Candidate Review Lifecycle

The Candidate review lifecycle tracks proposed domain knowledge until a human
reviewer rejects it, supersedes it through accepted knowledge, or deprecates it.

`stale` is a warning state for old unresolved Candidates. It is not accepted
knowledge.
