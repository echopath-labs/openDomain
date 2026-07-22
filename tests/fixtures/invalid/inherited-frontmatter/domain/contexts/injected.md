---
__proto__:
  type: bounded_context
  id: injected
  name: Injected through object prototype
  status: accepted
  evidence:
    - type: human_review
      location: tests/fixtures/invalid/inherited-frontmatter
      summary: This metadata must never be accepted from an inherited object.
      confidence: high
  review:
    state: accepted
    reviewed_by: fixture
    reviewed_at: 2026-07-22
---

# Injected

This fixture verifies that inherited front matter cannot become a document.
