---
type: domain_event
id: sales.order-confirmed
name: Order Confirmed
context: sales
status: accepted
past_tense_name: OrderConfirmed
occurs_when: A submitted order is approved and becomes confirmed.
applies_to:
  - sales.order
related_lifecycle:
  - sales.order-lifecycle
evidence:
  - type: human_review
    location: examples/erp/domain/lifecycles/sales.order-lifecycle.md
    summary: Example fixture emits OrderConfirmed when the order enters Confirmed.
    confidence: high
review:
  state: accepted
  reviewed_by: example-domain-owner
  reviewed_at: 2026-06-29
---

# Order Confirmed

Order Confirmed is the business fact that a submitted order has been approved
and moved into the Confirmed state.

## Agent Guidance

Do not treat this event as a queue implementation detail. It expresses a
business fact first.
