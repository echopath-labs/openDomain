---
type: bounded_context
id: sales
name: Sales
status: accepted
owners:
  - example-sales-domain-owner
evidence:
  - type: human_review
    location: examples/erp/README.md
    summary: Example Sales context is intentionally accepted for OpenDomain fixtures.
    confidence: high
review:
  state: accepted
  reviewed_by: example-domain-owner
  reviewed_at: 2026-06-29
---

# Sales

Sales is the bounded context for customer-facing commercial orders.

## Scope

The Sales context owns the commercial meaning of an Order before fulfillment and
invoicing.
