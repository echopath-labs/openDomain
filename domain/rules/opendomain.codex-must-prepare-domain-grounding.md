---
type: business_rule
id: opendomain.codex-must-prepare-domain-grounding
name: Codex must prepare domain grounding
context: opendomain
status: accepted
applies_to:
  - opendomain.grounding-pack
severity: must
rule_type: policy
evidence:
  - type: spec
    location: AGENTS.md
    summary: Repository instructions require running opendomain prepare before non-trivial OpenSpec-style feature implementation.
    confidence: high
  - type: spec
    location: docs/mvp-grounding-demo.md
    summary: Codex protocol requires running opendomain prepare and reporting Domain Grounding Used.
    confidence: high
review:
  state: accepted
  reviewed_by: human-maintainer
  reviewed_at: 2026-07-03
---

# Codex Must Prepare Domain Grounding

Before implementing a non-trivial feature spec, Codex should prepare a Domain
Grounding Pack and read the accepted OpenDomain files listed under `Read first`.

## Agent Guidance

Run:

```bash
npm run opendomain -- prepare <feature-spec-or-dir>
```

Then report `Domain Grounding Used` in the final response.
