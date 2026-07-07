---
type: lifecycle
id: sales.order-lifecycle
name: Order lifecycle
context: sales
status: accepted
applies_to:
  - sales.order
states:
  - id: draft
    name: Draft
    terminal: false
  - id: submitted
    name: Submitted
    terminal: false
  - id: confirmed
    name: Confirmed
    terminal: false
  - id: cancelled
    name: Cancelled
    terminal: true
  - id: fulfilled
    name: Fulfilled
    terminal: true
transitions:
  - from: draft
    to: submitted
    trigger: submit_order
  - from: submitted
    to: confirmed
    trigger: confirm_order
  - from: submitted
    to: cancelled
    trigger: cancel_order
  - from: confirmed
    to: fulfilled
    trigger: fulfill_order
  - from: confirmed
    to: cancelled
    trigger: cancel_order
forbidden_transitions:
  - from: confirmed
    to: draft
    reason: Confirmed orders cannot return to draft without a correction flow.
related_rules:
  - sales.confirmed-order-cannot-be-deleted
evidence:
  - type: human_review
    location: examples/erp/domain/concepts/sales.order.md
    summary: Example fixture defines the accepted order lifecycle.
    confidence: high
review:
  state: accepted
  reviewed_by: example-domain-owner
  reviewed_at: 2026-06-29
---

# Order Lifecycle

The accepted Order lifecycle starts in Draft, moves through Submitted and
Confirmed, and then reaches either Fulfilled or Cancelled.

## Agent Guidance

Do not add new terminal states without creating a Domain Candidate and getting
human review.
