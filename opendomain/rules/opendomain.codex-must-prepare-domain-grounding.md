---
type: business_rule
id: opendomain.codex-must-prepare-domain-grounding
name: Codex must prepare domain grounding
context: opendomain
status: accepted
compatibility_note: Evidence references moved to public product artifacts; semantic meaning is unchanged.
applies_to:
  - opendomain.grounding-pack
severity: must
rule_type: policy
evidence:
  - type: spec
    location: README.zh-CN.md
    summary: The public workflow instructs Agents to prepare grounding before non-trivial feature implementation.
    confidence: high
  - type: test
    location: tests/cli.test.mjs
    summary: CLI tests verify task-scoped Grounding Pack preparation and Agent guidance.
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
