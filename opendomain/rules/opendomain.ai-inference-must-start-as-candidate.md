---
type: business_rule
id: opendomain.ai-inference-must-start-as-candidate
name: AI inference must start as Candidate
context: opendomain
status: accepted
applies_to:
  - opendomain.domain-knowledge
  - opendomain.domain-candidate
severity: must
rule_type: invariant
evidence:
  - type: spec
    location: docs/OPEN_DOMAIN_DEVELOPMENT_GUIDE.md
    summary: AI-discovered domain knowledge defaults to Candidate rather than accepted knowledge.
    confidence: high
  - type: spec
    location: docs/candidate-workflow.md
    summary: Candidate workflow is the safety boundary between AI inference and accepted business knowledge.
    confidence: high
review:
  state: accepted
  reviewed_by: human-maintainer
  reviewed_at: 2026-07-03
---

# AI Inference Must Start As Candidate

When Codex infers new domain knowledge from code, API, database schema, tests,
specs, ADRs, or discussion, it must record that knowledge as a Candidate first.

## Agent Guidance

Create or update a Candidate. Do not silently edit accepted knowledge.
