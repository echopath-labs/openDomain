---
type: domain_candidate
id: candidate-0011-grounding-assurance
status: proposed
proposed_change_type: add_concept
target:
  type: domain_concept
  id: opendomain.grounding-assurance
confidence: medium
extracted_by: codex
extracted_at: 2026-07-31
evidence:
  - type: spec
    location: schemas/assurance-result.schema.json
    summary: The public result contract separates grounding requirement, preparation state, policy outcome, findings, and grounding evidence.
    confidence: high
  - type: code
    location: src/assurance.mjs
    summary: The read-only evaluator reuses Grounding Pack preparation and applies invocation-scoped advisory or enforced policy.
    confidence: high
  - type: test
    location: tests/assurance.test.mjs
    summary: Synthetic conformance fixtures exercise required, not-required, unclassified, initialized brownfield gap, legacy, contradiction, broken-reference, and policy-mode behavior.
    confidence: high
possible_conflicts:
  - Partial grounding for unclassified work was useful in controlled dogfooding but has not yet been validated through long-running external project use.
  - Workspace policy configuration and persisted Assurance Receipt ownership remain intentionally deferred.
  - Domain Declaration and Integration Profile schema 1.1 compatibility has not yet been implemented.
  - Candidate discovery based on accepted closure does not automatically surface an add-concept Candidate whose target ID does not yet exist.
review:
  state: proposed
  suggested_reviewer: opendomain-maintainer
---

# Candidate: Grounding Assurance

## Proposed Concept

Grounding Assurance is a read-only governance boundary that evaluates whether
an Agent-facing change has made an explicit grounding decision, whether trusted
OpenDomain context can be prepared, and whether the effective invocation policy
allows work to continue.

It keeps three dimensions separate:

- **Grounding Requirement** records `required`, `not_required`, or
  `unclassified` without inferring the decision from prose or empty references.
- **Preparation State** records whether accepted context is prepared,
  intentionally unnecessary, incomplete, or invalid.
- **Policy Outcome** records whether the advisory or enforced mode selected for
  the invocation passes, warns, or fails the current work.

## Agent-Driven Boundary

Humans own goals, boundaries, business judgment, risk acceptance, Candidate
promotion, and final acceptance. An Agent may classify grounding, select and
execute deterministic OpenDomain capabilities, investigate evidence, create
proposed Candidates, run validation, and report evidence inside those
boundaries.

Assurance provides structured findings and stop conditions. It does not become
a fixed workflow engine, require a user-maintained report, infer IDs from prose,
or mutate the workspace as a side effect.

## Brownfield Meaning

After OpenDomain workspace initialization, a change can require grounding before
the project has accepted OpenDomain IDs for the affected semantics. That state
is a visible Domain Model Gap. It is incomplete rather than invalid,
unnecessary, or unclassified, and it does not automatically create or accept a
Candidate. A missing workspace remains an environment error with an actionable
initialization step.

## Evidence Boundary

A dynamic Assurance Result reports the request, preparation, policy, findings,
and evidence observed during one invocation. Without source fingerprints,
repository identity, tool identity, and independent verification, it does not
prove which historical repository state was checked or that an Agent internally
understood the selected sources. A future optional Receipt may persist a
fingerprinted result, but it remains derived process evidence and not OpenDomain
source of truth.

## Compatibility Boundary

The first implementation adds an optional Grounding Request decision and a
derived Assurance Result without changing Grounding Protocol version `1.0`.
Accepting this concept would not make invocation modes a permanent workspace
policy or accept deferred Receipt and Profile `1.1` designs.

## Requested Human Review

The first vertical slice has now been exercised on OpenDomain's active change.
Keep this concept proposed until a human reviews that evidence and broader
project use confirms the three dimensions, partial unclassified grounding, and
Agent remediation boundary remain useful in practice.
