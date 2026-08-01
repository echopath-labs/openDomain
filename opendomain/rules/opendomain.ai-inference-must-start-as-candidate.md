---
type: business_rule
id: opendomain.ai-inference-must-start-as-candidate
name: AI inference must start as Candidate
context: opendomain
status: accepted
compatibility_note: Evidence references moved to public product artifacts; semantic meaning is unchanged.
applies_to:
  - opendomain.domain-knowledge
  - opendomain.domain-candidate
severity: must
rule_type: invariant
evidence:
  - type: spec
    location: README.zh-CN.md
    summary: The public workflow requires uncertain AI-discovered knowledge to start as a Domain Candidate.
    confidence: high
  - type: spec
    location: schemas/candidate.schema.json
    summary: The public Candidate contract captures evidence and review state before acceptance.
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
