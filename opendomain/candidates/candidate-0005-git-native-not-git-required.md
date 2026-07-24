---
type: domain_candidate
id: candidate-0005-git-native-not-git-required
status: proposed
proposed_change_type: add_rule
target:
  type: business_rule
  id: opendomain.git-native-not-git-required
confidence: high
extracted_by: codex
extracted_at: 2026-07-10
evidence:
  - type: spec
    location: openspec/changes/design-integration-profile-layer/design.md
    summary: The workspace design separates canonical content ownership from version-control tracking policy.
    confidence: high
  - type: human_review
    location: conversation:2026-07-10-grill-with-docs-version-control-ownership
    summary: The human maintainer confirmed that OpenDomain files should be versionable while Git tracking remains a user decision.
    confidence: high
possible_conflicts:
  - Existing documentation may use Git-native language that readers could misinterpret as requiring Git tracking.
  - Migration and dual-root behavior for legacy domain workspaces remain under review.
review:
  state: proposed
  suggested_reviewer: opendomain-maintainer
---

# Candidate: Git Native Does Not Mean Git Required

## Proposed Rule

OpenDomain-owned files must be compatible with file-based version control, but
OpenDomain must not require or control whether users track or ignore them.

## Meaning

`opendomain/` is canonical because it identifies where OpenDomain configuration
and content live. Canonical status does not depend on Git index state.

OpenDomain should preserve plain-text authoring, deterministic structure,
reviewable diffs, and stable paths so users can manage every OpenDomain-owned
file with Git or another version-control system when they choose.

## Forbidden Behavior

- requiring a `.git/` directory for normal OpenDomain workflows;
- automatically running `git add` for OpenDomain files;
- deciding which OpenDomain files a user must commit or ignore;
- treating untracked files as non-canonical solely because of Git status.

## Compatibility Note

Moving the canonical source root from `domain/` to `opendomain/` is a workspace
layout compatibility change and requires migration support during the alpha
series. The migration must not take ownership of the user's Git policy.

## Requested Human Review

Confirm migration behavior and update existing Git-native wording before
promoting this proposed rule into accepted OpenDomain knowledge.
