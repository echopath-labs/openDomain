---
type: business_rule
id: opendomain.index-is-derived-view-not-source-of-truth
name: Index is derived view, not source of truth
context: opendomain
status: accepted
applies_to:
  - opendomain.domain-knowledge
  - opendomain.grounding-pack
severity: must
rule_type: invariant
evidence:
  - type: spec
    location: docs/architecture.md
    summary: Derived views such as graph exports, search indexes, and MCP resources are rebuildable from Git files and are not authoritative.
    confidence: high
  - type: spec
    location: docs/product-prd.md
    summary: MVP treats derived views as later outputs and keeps Git files as source of truth.
    confidence: high
  - type: human_review
    location: conversation:2026-07-03-semantic-retrieval-index
    summary: Human maintainer agreed index should save tokens and support long-term retrieval while remaining derived from OpenDomain files.
    confidence: high
review:
  state: accepted
  reviewed_by: human-maintainer
  reviewed_at: 2026-07-04
---

# Index Is Derived View, Not Source Of Truth

Any OpenDomain index, graph, search view, embedding index, MCP resource, or
other retrieval artifact is a derived view.

The authoritative source remains OpenDomain files in Git.

## Agent Guidance

Use indexes to find relevant domain files. Verify important claims against the
source files before treating them as accepted knowledge.
