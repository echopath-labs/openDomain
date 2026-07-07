import assert from "node:assert/strict";
import test from "node:test";
import { parseMarkdown } from "../src/frontmatter.mjs";

test("parseMarkdown parses nested OpenDomain front matter", () => {
  const parsed = parseMarkdown(`---
type: domain_candidate
id: candidate-0001-order-lifecycle
status: proposed
target:
  type: lifecycle
  id: sales.order-lifecycle
evidence:
  - type: code
    location: src/order-status.ts
    summary: Fixture evidence.
    confidence: high
review:
  state: proposed
  suggested_reviewer: sales-owner
---

# Candidate
`, "candidate.md");

  assert.equal(parsed.frontmatter.type, "domain_candidate");
  assert.equal(parsed.frontmatter.target.id, "sales.order-lifecycle");
  assert.equal(parsed.frontmatter.evidence[0].confidence, "high");
  assert.equal(parsed.frontmatter.review.suggested_reviewer, "sales-owner");
});

test("parseMarkdown reports missing front matter", () => {
  assert.throws(
    () => parseMarkdown("# Missing front matter\n", "missing.md"),
    /missing YAML front matter/
  );
});
