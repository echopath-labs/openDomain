---
type: business_rule
id: BAD
name: 123
context: sales
status: accepted
applies_to: sales.order
severity: impossible
rule_type: impossible
evidence:
  - type: human_review
    location: tests/fixtures/invalid/schema-invalid-rule/domain/rules/invalid-rule.md
    summary: Structurally invalid Rule that previously entered Agent grounding.
    confidence: high
review:
  state: accepted
  reviewed_by: fixture-owner
  reviewed_at: 2026-02-30
---

# Invalid Rule

This fixture must never enter the validated corpus or a Grounding Pack.
