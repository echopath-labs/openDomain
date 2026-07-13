---
type: domain_candidate
id: candidate-0007-domain-declaration
status: proposed
proposed_change_type: add_concept
target:
  type: domain_concept
  id: opendomain.domain-declaration
confidence: high
extracted_by: codex
extracted_at: 2026-07-11
evidence:
  - type: spec
    location: openspec/changes/design-integration-profile-layer/design.md
    summary: The design defines Embedded and Sidecar Domain Declarations as mutually exclusive transports over one shared schema.
    confidence: high
  - type: human_review
    location: conversation:2026-07-11-grill-with-docs-domain-declaration-modes
    summary: The human maintainer confirmed Embedded and Sidecar as formal declaration modes using one schema.
    confidence: high
  - type: human_review
    location: conversation:2026-07-11-grill-with-docs-reference-acquisition
    summary: The human maintainer confirmed Native Mapping as a separate acquisition mode that adapts external schema without using Domain Declaration.
    confidence: high
  - type: human_review
    location: conversation:2026-07-11-grill-with-docs-declaration-schema
    summary: The human maintainer confirmed a strict Domain Declaration containing only schema_version and non-empty affects_domain references.
    confidence: high
possible_conflicts:
  - The first built-in source readers and exact fenced-block encoding are not implemented yet.
review:
  state: proposed
  suggested_reviewer: opendomain-maintainer
---

# Candidate: Domain Declaration

## Proposed Concept

Domain Declaration is explicit, structured input that tells Profile Runtime
which OpenDomain references an external work artifact declares.

## Transport Modes

- **Embedded Declaration**: YAML front matter or an explicitly labeled
  `opendomain` fenced block inside the external artifact.
- **Sidecar Declaration**: a neighboring `opendomain.yaml` that leaves the
  external artifact unchanged.

Both modes use one shared declaration schema. When a Profile uses Domain
Declaration, it selects exactly one transport for one input. If both are
present, processing fails with an ambiguity diagnostic rather than merging or
choosing an implicit winner.

## Boundary

Domain Declaration contains explicit structured values. It is not ordinary
artifact prose, inferred domain knowledge, or the final Grounding Request.
Profile Runtime validates and normalizes it into Grounding Protocol input.

Native Mapping is not Domain Declaration. It adapts explicit structured fields
owned by an external tool's schema directly into Grounding Request fields.

## Proposed Schema

```yaml
schema_version: "1.0"
affects_domain:
  concepts:
    - sales.order
  rules: []
  lifecycles: []
  events: []
```

At least one OpenDomain ID is required. Unknown top-level fields are rejected.
Source, intent, status, integration settings, free-form metadata, and copied
domain definitions are outside Domain Declaration.

## Compatibility Note

Adding a new declaration transport may expand Profile Runtime compatibility,
but changing the shared declaration schema requires declaration compatibility
review. Neither change may silently alter stable Grounding Request semantics.

## Requested Human Review

Review the confirmed declaration boundary before promotion.
