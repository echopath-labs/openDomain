---
type: domain_candidate
id: candidate-0001-order-lifecycle
status: proposed
proposed_change_type: update_lifecycle
target:
  type: lifecycle
  id: sales.order-lifecycle
confidence: medium
extracted_by: codex
extracted_at: 2026-06-29
evidence:
  - type: spec
    location: examples/erp/domain/lifecycles/sales.order-lifecycle.md
    summary: Accepted lifecycle has Fulfilled as terminal but no Closed state.
    confidence: medium
possible_conflicts:
  - Existing accepted lifecycle does not include Closed.
review:
  state: proposed
  suggested_reviewer: example-sales-domain-owner
---

# Candidate: Order Lifecycle Closed State

Codex found a possible lifecycle refinement:

```text
Fulfilled -> Closed?
```

## Reasoning Summary

Some ERP teams distinguish fulfillment from commercial closure. This example
candidate does not assert that Closed is true. It asks a human reviewer whether
Closed should be part of the accepted Sales Order lifecycle.

## Requested Human Review

Please confirm whether `Closed` is a valid terminal state for `sales.order`.
