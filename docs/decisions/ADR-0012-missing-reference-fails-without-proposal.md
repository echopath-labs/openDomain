# ADR-0012: Missing Reference Fails Without Proposal

## Status

Accepted

## Context

A missing OpenDomain ID may be a typo, stale reference, or Profile mapping
error. The missing string alone lacks the evidence and proposed content needed
for a valid Domain Candidate.

## Decision

`prepare` fails deterministically on missing references and reports the source,
field, and missing ID. It does not automatically create a Candidate or present
grounding as successful.

A future explicit proposal workflow may be designed separately, but it must
require evidence and proposed content and must remain Candidate-only.

## Consequences

- Invalid grounding cannot masquerade as successful preparation.
- Typographical errors do not create Candidate noise.
- Domain discovery remains an explicit, evidence-backed workflow.
- Future proposal UX remains outside the current milestone.
