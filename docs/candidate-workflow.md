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

## CLI Review Commands

Use Candidate commands to inspect and record review decisions:

```bash
opendomain candidate list [path]
opendomain candidate show <candidate-id> [path]
opendomain candidate review <candidate-id> --decision accepted|rejected|superseded|deprecated --reviewed-by <name> --reason <text> [path]
```

`candidate review` only updates the Candidate file. It never copies proposed
content into accepted OpenDomain source files.

Because a Candidate cannot have `status: accepted`, `--decision accepted`
records the Candidate as `superseded`. The human reviewer must still promote the
accepted semantics manually into the target OpenDomain file with evidence and
review metadata.

Use `--reviewed-at YYYY-MM-DD` when the review date needs to be explicit.

Promotion patch previews are intentionally deferred. When added, they should be
preview-only and must not apply accepted knowledge automatically.

## Conflict Rule

When evidence conflicts, Codex should not resolve it silently. It should record:

- evidence for
- evidence against
- possible conflict
- suggested resolution
- review required
