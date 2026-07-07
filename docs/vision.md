# OpenDomain Vision

OpenDomain exists to give AI agents a durable, reviewable understanding of the
business world behind a software system.

The long-term goal is not to create another documentation site. The goal is to
create a semantic contract between business reality, software assets, human
reviewers, and AI agents.

## Product Promise

OpenDomain should let an agent answer these questions before changing software:

- Which business concepts are involved?
- What does each concept mean in its bounded context?
- What is this concept not?
- Which rules, lifecycles, events, and relationships must remain true?
- Which evidence supports those claims?
- Which knowledge is accepted, proposed, rejected, deprecated, or superseded?

## Design Commitments

- Git is the source of truth.
- Markdown plus structured metadata is the default authoring format.
- Human review is required before knowledge becomes accepted.
- Evidence is required for important domain claims.
- Derived graphs, indexes, and search views are rebuildable outputs.
- OpenSpec references OpenDomain instead of duplicating it.
- Candidate workflow is the safe path for AI-discovered knowledge.
