import assert from "node:assert/strict";
import test from "node:test";
import {
  FrontMatterError,
  parseJsonMapping,
  parseMarkdown,
  parseYamlMapping,
  serializeFrontmatter
} from "../src/frontmatter.mjs";

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

test("parseMarkdown rejects duplicate mapping keys at every depth", () => {
  assertFrontMatterFailure(`---
type: domain_concept
type: business_rule
review:
  state: proposed
  state: accepted
---
`, /duplicate|unique/i);
});

test("parseMarkdown rejects prototype-sensitive keys at every depth", () => {
  for (const key of ["__proto__", "constructor", "prototype"]) {
    assertFrontMatterFailure(`---
type: domain_concept
nested:
  ${key}:
    id: injected
---
`, new RegExp(key.replaceAll("_", "."), "i"));
  }
});

test("parseMarkdown rejects anchors, aliases, and explicit tags", () => {
  assertFrontMatterFailure(`---
type: &kind domain_concept
copy: *kind
---
`, /anchor|alias/i);

  assertFrontMatterFailure(`---
type: !!str domain_concept
---
`, /tag/i);
});

test("parseMarkdown rejects non-JSON scalar values", () => {
  assertFrontMatterFailure(`---
type: domain_concept
confidence: .nan
---
`, /finite|JSON/i);
});

test("parseMarkdown supports JSON-compatible YAML across BOM and CRLF delimiters", () => {
  const parsed = parseMarkdown(`\uFEFF---\r
type: domain_concept\r
name: "Order, \\"Quoted\\""\r
aliases: ["Sales, Order", "true", "null"]\r
guidance: |\r
  Read the accepted source.\r
  Keep candidates proposed.\r
review:\r
  state: proposed\r
---\r
\r
# Body\r
`, "compatible.md");

  assert.equal(Object.getPrototypeOf(parsed.frontmatter), null);
  assert.equal(Object.hasOwn(parsed.frontmatter, "type"), true);
  assert.equal(parsed.frontmatter.name, "Order, \"Quoted\"");
  assert.deepEqual(parsed.frontmatter.aliases, ["Sales, Order", "true", "null"]);
  assert.equal(parsed.frontmatter.guidance, "Read the accepted source.\nKeep candidates proposed.\n");
  assert.equal(parsed.frontmatter.review.state, "proposed");
  assert.equal(parsed.body, "\r\n# Body\r\n");
});

test("front matter serialization is semantically round-trippable without aliases", () => {
  const shared = { state: "proposed", note: "true, null: [draft] #1" };
  const source = {
    type: "domain_candidate",
    primary_review: shared,
    secondary_review: shared
  };

  const yaml = serializeFrontmatter(source, "roundtrip.md");
  const reparsed = parseMarkdown(`---\n${yaml}---\n\n# Body\n`, "roundtrip.md");

  assert.equal(yaml.includes("&a"), false);
  assert.equal(yaml.includes("*a"), false);
  assert.equal(reparsed.frontmatter.primary_review.note, shared.note);
  assert.equal(reparsed.frontmatter.secondary_review.note, shared.note);
  assert.notEqual(
    reparsed.frontmatter.primary_review,
    reparsed.frontmatter.secondary_review
  );
});

test("parseMarkdown rejects non-string and unsupported mapping keys", () => {
  assertFrontMatterFailure(`---
? [nested, key]
: value
---
`, /keys must be strings/i);

  assertFrontMatterFailure(`---
unsupported.key: value
---
`, /Unsupported front matter key/i);
});

test("standalone YAML and JSON mappings reuse the structured trust boundary", () => {
  const yaml = parseYamlMapping(`id: feature.add-x
intent:
  name: Add X
`, "feature.yaml");
  const json = parseJsonMapping(
    `{"id":"feature.add-x","intent":{"name":"Add X"}}`,
    "feature.json"
  );

  assert.equal(yaml.id, "feature.add-x");
  assert.equal(yaml.intent.name, "Add X");
  assert.equal(json.id, "feature.add-x");
  assert.equal(json.intent.name, "Add X");

  assert.throws(
    () => parseYamlMapping("__proto__: injected\n", "unsafe.yaml"),
    /prototype-sensitive/
  );
  assert.throws(
    () => parseJsonMapping(`{"constructor":"injected"}`, "unsafe.json"),
    /prototype-sensitive/
  );
  assert.throws(
    () => parseJsonMapping(`["not", "an", "object"]`, "array.json"),
    /must be an object/
  );
});

function assertFrontMatterFailure(content, pattern) {
  assert.throws(
    () => parseMarkdown(content, "unsafe.md"),
    (error) => (
      error instanceof FrontMatterError
      && error.file === "unsafe.md"
      && error.field === "$"
      && pattern.test(error.problem)
    )
  );
}
