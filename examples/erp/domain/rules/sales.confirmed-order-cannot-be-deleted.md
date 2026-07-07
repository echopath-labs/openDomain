---
type: business_rule
id: sales.confirmed-order-cannot-be-deleted
name: Confirmed order cannot be deleted directly
context: sales
status: accepted
applies_to:
  - sales.order
severity: must
rule_type: invariant
evidence:
  - type: human_review
    location: examples/erp/domain/concepts/sales.order.md
    summary: Example fixture treats confirmed order deletion as a stable invariant.
    confidence: high
review:
  state: accepted
  reviewed_by: example-domain-owner
  reviewed_at: 2026-06-29
---

# Confirmed Order Cannot Be Deleted Directly

A confirmed order cannot be physically deleted by normal business operations.

It may only be cancelled, closed, or corrected through approved business flows.

## Agent Guidance

Do not implement direct deletion APIs for confirmed orders unless a new accepted
domain rule supersedes this rule.
