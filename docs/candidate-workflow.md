# Candidate Workflow

Domain Candidates are the safety boundary between AI inference and accepted
business knowledge.

## Workflow

```text
Select analysis scope
  ↓
Read code, API, database schema, tests, specs, ADRs, and docs
  ↓
Identify candidate concepts, rules, lifecycles, events, and relationships
  ↓
Compare with existing OpenDomain knowledge
  ↓
Write a Domain Candidate with evidence and confidence
  ↓
Human review accepts, rejects, supersedes, deprecates, or requests changes
```

## Required Candidate Metadata

A candidate must include:

- stable candidate id
- proposed change type
- target object type and id
- proposed content
- evidence
- confidence
- possible conflicts
- suggested reviewer
- review state

## Promotion Rule

A candidate does not become accepted knowledge automatically.

Promotion requires:

- a human reviewer
- a review decision
- evidence retained on the accepted object
- compatibility notes when existing accepted semantics change

## Conflict Rule

When evidence conflicts, Codex should not resolve it silently. It should record:

- evidence for
- evidence against
- possible conflict
- suggested resolution
- review required
