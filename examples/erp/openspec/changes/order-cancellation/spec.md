---
type: feature_spec
id: spec.order-cancellation
name: Order cancellation
status: proposed
grounding:
  status: required
  rationale: Cancellation behavior is constrained by accepted order semantics and lifecycle rules.
affects_domain:
  concepts:
    - sales.order
  rules:
    - sales.confirmed-order-cannot-be-deleted
  lifecycles:
    - sales.order-lifecycle
  events:
    - sales.order-confirmed
---

# Order Cancellation

This example feature allows users to cancel eligible sales orders.

## Intent

Order cancellation should use cancellation semantics. It must not introduce
direct deletion behavior for confirmed orders.

## Domain Grounding

Before implementing this feature, an Agent must read:

- `sales.order`
- `sales.order-lifecycle`
- `sales.confirmed-order-cannot-be-deleted`

## Candidate Boundary

If implementation evidence suggests a `Closed` terminal state, the Agent should
create or update a Domain Candidate. It should not silently add `Closed` to the
accepted lifecycle.
