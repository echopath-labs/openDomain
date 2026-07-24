---
type: business_rule
id: opendomain.codex-readable-entrypoints-must-be-structured
name: Codex-readable entrypoints must be structured
context: opendomain
status: accepted
applies_to:
  - opendomain.domain-knowledge
  - opendomain.grounding-pack
severity: must
rule_type: policy
evidence:
  - type: spec
    location: docs/OPEN_DOMAIN_DEVELOPMENT_GUIDE.md
    summary: OpenDomain files should be human reviewable, agent parseable, Git diffable, and tooling validated.
    confidence: high
  - type: spec
    location: docs/product-prd.md
    summary: OpenDomain's primary user is an AI coding agent that must locate and consume relevant domain semantics before changing software.
    confidence: high
  - type: human_review
    location: conversation:2026-07-06-codex-readability
    summary: Human maintainer accepted Codex readability as a core design criterion for OpenDomain.
    confidence: high
review:
  state: accepted
  reviewed_by: human-maintainer
  reviewed_at: 2026-07-06
---

# Codex-Readable Entrypoints Must Be Structured

OpenDomain should make the default Codex reading path stable, small,
structured, and traceable.

The preferred consumption path is:

1. Use a task-scoped entrypoint such as a Grounding Pack or derived index.
2. Read the relevant accepted OpenDomain source files.
3. Treat related Candidates as proposed boundaries.
4. Verify important claims against evidence and review metadata.

## Agent Guidance

Do not make Codex depend on broad repository scans, long narrative pages, hidden
relationships, or index-only facts when it needs accepted domain knowledge.
