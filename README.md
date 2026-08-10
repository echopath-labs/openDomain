# OpenDomain

[![CI](https://github.com/echopath-labs/openDomain/actions/workflows/ci.yml/badge.svg)](https://github.com/echopath-labs/openDomain/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/%40echopath-labs%2Fopendomain/alpha?label=npm)](https://www.npmjs.com/package/@echopath-labs/opendomain)
![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)
![Status](https://img.shields.io/badge/status-alpha-f59e0b.svg)
![Node](https://img.shields.io/badge/node-%3E%3D20-0f766e.svg)
![Source](https://img.shields.io/badge/source-Markdown%20%2B%20YAML-2563eb.svg)

> Simplified Chinese: [README.zh-CN.md](README.zh-CN.md)

OpenDomain is a Git-native, evidence-backed domain semantic layer for AI
agents and human maintainers. It keeps long-lived business concepts, rules,
lifecycles, events, evidence, and review state in repository-readable Markdown.

## Start With Codex

Open a shell-enabled Codex task in the project you want to model and say:

> Install OpenDomain in this workspace. Follow the official Agent installation
> contract, initialize the Codex integration, and prove that it is ready without
> adding package metadata to this project.

Codex should follow the [Agent Installation Contract](INSTALL.md), choose a
compatible installation channel, run initialization or update, then verify the
workspace with `doctor` and `validate`.

After installation, keep working in natural language:

> Explore the accepted business model for order cancellation. Do not modify
> anything, and keep Candidate knowledge separate.

> Reverse-model this existing project from its code and product documentation.
> Put every uncertain business claim into a Candidate for review.

> Review candidate-0001. Show its evidence, conflicts, and compatibility impact,
> then wait for my decision.

> Implement this change. Complete OpenDomain grounding before modifying
> behavior, and report the accepted IDs and Candidate boundaries you used.

The managed repository instructions and Codex Skills route these intentions to
OpenDomain. Users do not need to choose routine CLI commands themselves. See the
[complete Usage Guide](USAGE.md) for the observable workflow and recovery paths.

## Human And Agent Responsibilities

OpenDomain uses bounded Agent autonomy:

| Human owns | Codex owns |
| --- | --- |
| Goals and expected outcomes | Reading repository instructions and environment |
| Business boundaries and final meaning | Selecting the appropriate OpenDomain workflow |
| Risk trade-offs and Candidate decisions | Running tools and preserving evidence boundaries |
| Final acceptance | Reporting validation and unresolved gaps |

AI-inferred knowledge never becomes accepted domain knowledge automatically.
It starts as a Domain Candidate and requires an explicit human review decision.
Codex cannot bypass shell, network, filesystem, repository, or approval policy.

## Product Boundary

```text
OpenDomain
  Long-lived business semantics
  What the business world is and which rules remain true

OpenSpec / Spec Kit / other planning tools
  Change intent and delivery specification
  Why this change exists, what is delivered, and how it is accepted

EchoPath
  Agent execution continuity
  How Agent work is recovered, handed off, and resumed
```

OpenSpec and other planning sources may declare affected OpenDomain IDs. They
should reference accepted domain knowledge, not duplicate its definitions.

## What Gets Added To A Project

`opendomain init --tools codex` creates or updates only OpenDomain-owned
resources:

```text
opendomain/
  config.yaml
  contexts/
  concepts/
  rules/
  lifecycles/
  events/
  candidates/

AGENTS.md                              managed OpenDomain block
.codex/skills/opendomain-explore/     generated Skill
.codex/skills/opendomain-model/       generated Skill
.codex/skills/opendomain-review/      generated Skill
```

The command preserves user-owned content. It does not create or modify the host
project's `package.json`, lockfile, dependencies, or npm scripts. Whether these
files are committed is the project's decision; they are compatible with normal
Git versioning.

## Manual Installation

Most users should ask Codex to install OpenDomain. The same channels are
available manually.

### npm alpha channel

Use npm when Node.js 20 or Node.js 22 and newer is already available:

```bash
npm install --global @echopath-labs/opendomain@alpha
opendomain --version
opendomain init --tools codex
opendomain doctor
opendomain validate
```

The explicit `@alpha` tag is required during prerelease development.

### Standalone binary

When a compatible npm environment is unavailable, download the matching binary
and `SHA256SUMS.txt` from [GitHub Releases](https://github.com/echopath-labs/openDomain/releases).
Verify the exact checksum before execution.

| Target | Minimum system |
| --- | --- |
| `darwin-arm64` / `darwin-x64` | macOS 13.5 |
| `linux-x64` | kernel 4.18, glibc 2.28, `GLIBCXX_3.4.25` |
| `windows-x64.exe` | Windows 10 or Windows Server 2016 |

The initial macOS binaries are ad-hoc signed but not notarized. Windows binaries
are not Authenticode signed. Checksums detect file changes but do not establish
publisher identity. See [Installation channels](USAGE.md#installation-channels)
for verification and upgrade steps.

## Current Capabilities

The current alpha includes:

- Markdown with YAML front matter as the source of truth;
- schema validation and reference integrity checks;
- accepted concepts, rules, lifecycles, events, and evidence;
- Candidate-first AI inference with explicit human review;
- deterministic Semantic Closure and derived read-first indexes;
- optional multi-product workspace governance with deterministic exposure and publication-closure validation;
- a side-effect-free Embeddable Core v1 with source-first query and versioned context export;
- Grounding Request, Grounding Pack, and advisory/enforced Assurance;
- built-in OpenSpec grounding and declarative Integration Profiles;
- managed Codex instructions, Skills, updates, and diagnostics;
- npm and standalone CLI distribution without host package metadata.

OpenDomain is suitable for bounded trials and public iteration. The format and
CLI may still change before a stable release, and it should not yet be the sole
governance source for production-critical domain decisions.

For a multi-product canonical workspace, add a versioned
`opendomain/governance.yaml` and place each domain group's normal semantic
directories under its declared `source_root`. `opendomain validate --json`
then returns product/group ownership, dependency graphs, exposure diagnostics,
and derived public dependency closures. A passing closure is static evidence;
it does not publish files, grant permissions, change Git, or require EchoPath.
See [Multi-product workspace governance](USAGE.md#multi-product-workspace-governance).

Host and plugin authors can import the package root or `@echopath-labs/opendomain/core`
to call the same validate, query, and context-export implementation used by the
CLI. `opendomain export context` returns accepted content and reports related
Candidates separately; `--exposure public --product <id>` succeeds only from a
validated public dependency closure. The API is read-only and does not manage
EchoPath memory, accept Candidates, write projections, or publish releases. See
[Embed Core and export context](USAGE.md#embed-core-and-export-context).

## Public Resources

- [Usage Guide](USAGE.md)
- [Agent Installation Contract](INSTALL.md)
- [ERP example](examples/erp/README.md)
- [Changelog](CHANGELOG.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- `schemas/` for machine-readable contracts

Maintainer planning records are private process material and are not shipped in
the public repository or npm package. The OpenSpec fixture under `examples/erp/`
is synthetic interoperability data.

OpenDomain is licensed under the [MIT License](LICENSE).
