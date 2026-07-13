# ADR-0011: Context Budget Is Advisory

## Status

Accepted

## Context

EchoPath and other consumers need visibility into context cost, but token
accounting is approximate and model-dependent. Allowing estimates to control
grounding could hide semantically required knowledge or Candidate boundaries.

## Decision

Context Budget reports deterministic advisory estimates. It separates required
accepted source cost from optional Candidate source cost and discloses the
estimator ID and version.

OpenDomain does not automatically truncate files, remove accepted sources, hide
Candidate boundaries, or change grounding selection to satisfy an estimate.
Semantic integrity, traceability, and long-term discoverability outrank token
efficiency.

## Consequences

- Consumers can observe likely context cost without treating it as exact.
- The same estimator version produces repeatable estimates.
- Future hard limits or selection policies require a separate protocol review.
- Token savings remain a secondary derived benefit.
