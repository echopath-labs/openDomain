---
type: domain_concept
id: sales.order
name: Order
context: sales
status: accepted
version: 1
aliases:
  - Sales Order
not_synonyms:
  - Invoice
  - Shipment
owners:
  - example-sales-domain-owner
related: []
rules:
  - sales.confirmed-order-cannot-be-deleted
lifecycles:
  - sales.order-lifecycle
events:
  - sales.order-confirmed
evidence:
  - type: human_review
    location: examples/erp/opendomain/contexts/sales.md
    summary: Example fixture defines Order as the central Sales concept.
    confidence: high
review:
  state: accepted
  reviewed_by: example-domain-owner
  reviewed_at: 2026-06-29
---

# Order

An Order represents a customer's commercial request to purchase products or
services.

## Business Meaning

An Order is created in the Sales context and tracks the commercial lifecycle
before fulfillment and invoicing.

## Not This

- An Order is not an Invoice.
- An Order is not a Shipment.
- An Order is not a shopping cart unless the Sales context explicitly defines it
  that way.

## Agent Guidance

Before modifying order-related behavior, check:

- `sales.order-lifecycle`
- `sales.confirmed-order-cannot-be-deleted`
- `sales.order-confirmed`
