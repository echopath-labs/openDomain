---
type: domain_candidate
id: candidate-0003-grounding-protocol-boundary
status: proposed
proposed_change_type: add_concept
target:
  type: domain_concept
  id: opendomain.grounding-protocol
confidence: high
extracted_by: codex
extracted_at: 2026-07-10
evidence:
  - type: spec
    location: openspec/changes/design-integration-profile-layer/design.md
    summary: The integration design separates Grounding Protocol, Profile Runtime, and Consumer Conformance responsibilities.
    confidence: high
  - type: human_review
    location: conversation:2026-07-10-grill-with-docs-integration-boundary
    summary: The human maintainer confirmed that Grounding Protocol is the only stable core integration contract.
    confidence: high
  - type: human_review
    location: conversation:2026-07-10-grill-with-docs-protocol-fields
    summary: The human maintainer confirmed explicit protocol versioning, a minimal stable field set, and optional integration metadata.
    confidence: high
  - type: human_review
    location: conversation:2026-07-10-grill-with-docs-profile-config
    summary: The human maintainer confirmed root-level opendomain.config.yaml as the canonical Profile Runtime configuration entrypoint.
    confidence: high
  - type: human_review
    location: conversation:2026-07-10-grill-with-docs-workspace-reconsideration
    summary: The human maintainer withdrew the root-config decision and proposed a tracked opendomain workspace analogous to openspec.
    confidence: high
  - type: human_review
    location: conversation:2026-07-10-grill-with-docs-version-control-ownership
    summary: The human maintainer confirmed opendomain as the canonical workspace while keeping Git tracking and ignore policy user-owned.
    confidence: high
possible_conflicts:
  - Context Budget semantics are decided, but the estimator is not implemented yet.
  - Profile extraction behavior remains an open design question.
  - The internal OpenDomain workspace tree and derived-output location are under review.
review:
  state: proposed
  suggested_reviewer: opendomain-maintainer
---

# Candidate: Grounding Protocol Boundary

## Proposed Concept

Grounding Protocol is the stable, tool-neutral OpenDomain integration contract
that accepts a Grounding Request and produces a Grounding Pack.

## Proposed Language

- **Grounding Protocol**: the stable core request-to-pack contract.
- **Profile Runtime**: an optional, replaceable facility that maps external
  tool files into Grounding Requests.
- **Consumer Conformance**: verification that a consumer can use Grounding Pack
  output while preserving accepted knowledge and Candidate boundaries.

## Boundary

Profile Runtime and Consumer Conformance are not parts of the stable Grounding
Protocol. External tool and EchoPath-specific concepts must not become protocol
fields.

## Compatibility Note

A change to an external tool's file format may require a profile update, but it
is not a Grounding Protocol breaking change when the updated profile produces a
compatible Grounding Request. Changes to stable Grounding Request or Grounding
Pack fields may be protocol compatibility changes once those fields are
accepted.

The proposed v1 stable Grounding Request fields are `protocol_version`,
`source`, `intent`, and `affects_domain`. The proposed v1 stable Grounding Pack
fields are `protocol_version`, `grounding_request`, `read_first`,
`candidate_boundaries`, `context_budget`, `errors`, and `warnings`.

OpenSpec-specific `feature` output, Profile Runtime selection details, display
names, and derived semantic guidance are optional metadata. Existing alpha JSON
fields may remain temporarily for compatibility, but their presence does not
make them part of the stable protocol.

## Profile Runtime Configuration Boundary

The earlier root-level `opendomain.config.yaml` proposal was withdrawn.
`opendomain/` now replaces `domain/` as the canonical workspace analogous to
`openspec/`. Canonical identifies content location and authority; it does not
require Git tracking. The internal workspace tree and derived-output location
remain under review and do not expand the stable Grounding Protocol field set.

## Requested Human Review

Review this Candidate after the remaining Profile Runtime decisions are
resolved. Until then, treat the terminology as proposed domain knowledge even
though the OpenSpec design boundary is confirmed.
