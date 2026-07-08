---
type: domain_candidate
id: candidate-9998-final-without-reason
status: rejected
proposed_change_type: add_concept
target:
  type: domain_concept
  id: fixture.missing-concept
confidence: medium
extracted_by: codex
extracted_at: 2026-07-08
evidence:
  - type: spec
    location: tests/fixtures/invalid/candidate-final-without-review-reason
    summary: Fixture Candidate missing final review reason.
    confidence: medium
review:
  state: rejected
  suggested_reviewer: fixture-reviewer
  reviewed_by: fixture-reviewer
  reviewed_at: 2026-07-08
---

# Candidate Missing Final Review Reason

This rejected Candidate is invalid because final decisions must explain the
review reason.
