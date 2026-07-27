# ERP Example

This example demonstrates the smallest useful OpenDomain shape:

- one bounded context
- one domain concept
- one lifecycle
- one business rule
- one domain event
- one proposed candidate
- one declarative Integration Profile
- one structured non-OpenSpec feature source

Run both grounding paths from this directory:

```bash
opendomain prepare openspec/changes/order-cancellation/spec.md
opendomain integrations validate
opendomain prepare --profile structured-feature external-features/order-cancellation.yaml
```

Both planning formats explicitly reference the same accepted OpenDomain IDs.
The Profile only normalizes structured fields; it does not infer domain
knowledge.

The example is intentionally simple. It is not a full ERP model.
