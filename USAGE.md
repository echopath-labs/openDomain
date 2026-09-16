# OpenDomain Usage Guide

> Simplified Chinese: [USAGE.zh-CN.md](USAGE.zh-CN.md) | Project overview:
> [README.md](README.md) | Agent installation contract: [INSTALL.md](INSTALL.md)

This guide is for teams that want Codex to use OpenDomain as part of normal
engineering work. You express the goal; Codex selects and executes the bounded
OpenDomain workflow and shows its evidence.

## Before You Start

OpenDomain stores long-lived business semantics, not every fact in a software
repository. Start with one real bounded context and a small set of concepts,
rules, or lifecycles that materially constrain implementation.

The responsibility boundary stays explicit:

- You own the goal, business boundary, risk trade-offs, Candidate decisions,
  and final acceptance.
- Codex owns environment inspection, workflow selection, tool execution,
  evidence separation, validation, and reporting.
- Repository policy and tool approvals remain in force.
- Inferred semantics start as Candidates. They are not accepted truth.

## Ask Codex To Install OpenDomain

From the repository root, say:

> Install OpenDomain in this workspace. Follow the official Agent installation
> contract, initialize the Codex integration, and prove that it is ready without
> adding package metadata to this project.

Codex should:

1. Inspect the repository instructions and intended workspace root.
2. Reuse a healthy `opendomain` CLI already on `PATH`, or install through a
   compatible channel.
3. Run initialization for a new integration or update an existing managed one.
4. Run diagnostics and repository validation.
5. Report the CLI version, installation path, files changed, and check results.
6. Confirm that host `package.json` and lockfiles were not created or modified.

The observable command sequence is:

```bash
opendomain --version
opendomain init --tools codex --json
opendomain doctor --json
opendomain validate --json
```

For an existing configured integration, Codex uses:

```bash
opendomain update --json
opendomain doctor --json
opendomain validate --json
```

Initialization may generate Skills that the current Codex task cannot hot-load.
The installing Agent must still finish the installation, diagnostics, and
validation directly. Subsequent tasks discover the managed repository block and
generated Skills automatically.

## Installation Channels

The [Agent Installation Contract](INSTALL.md) is authoritative for channel
selection and safety.

### npm stable release

Prefer npm when Node.js 20 or Node.js 22 and newer is already available:

```bash
npm install --global @echopath-labs/opendomain
opendomain --version
```

This is a global tool installation. Do not add OpenDomain to the host project's
dependencies or scripts. Do not use `sudo npm install` by default.

### Verified standalone executable

Use the standalone fallback when a compatible npm environment is unavailable.
Download the executable and `SHA256SUMS.txt` for the same version from
[GitHub Releases](https://github.com/echopath-labs/openDomain/releases).

| Target | Minimum system |
| --- | --- |
| `darwin-arm64` / `darwin-x64` | macOS 13.5 |
| `linux-x64` | kernel 4.18, glibc 2.28, `GLIBCXX_3.4.25` |
| `windows-x64.exe` | Windows 10 or Windows Server 2016 |

Verify with `shasum -a 256` on macOS, `sha256sum` on Linux, or
`Get-FileHash -Algorithm SHA256` in PowerShell. Install only into a user-owned
directory on `PATH`. macOS binaries are currently ad-hoc signed but not
notarized; Windows binaries are not Authenticode signed.

Pin `@echopath-labs/opendomain@0.1.1` when exact reproducibility is required.
The native `--request` entry requires `0.1.1` or newer. Upgrade an npm-installed
CLI with `npm install --global @echopath-labs/opendomain@0.1.1`; `opendomain update`
only refreshes workspace instructions. No business model migration is required.
Future prereleases remain explicit and cannot move npm `latest`. Upgrade
standalone installations by downloading, verifying, and replacing the
executable. Then run:

```bash
opendomain update --json
opendomain doctor --json
opendomain validate --json
```

## What Initialization Changes

The canonical workspace is `opendomain/`. During `0.x`, a legacy `domain/`
workspace is a warned fallback only when the canonical root is absent. If both
exist, `opendomain/` wins; OpenDomain never merges the roots.

Codex initialization manages:

- `opendomain/config.yaml` and the initial semantic directories;
- one marked OpenDomain block in `AGENTS.md`;
- `.codex/skills/opendomain-explore/SKILL.md`;
- `.codex/skills/opendomain-model/SKILL.md`;
- `.codex/skills/opendomain-review/SKILL.md`.

Existing content outside the managed block remains user-owned. A conflicting
user-owned Skill is reported rather than overwritten.

## Multi-Product Workspace Governance

The existing single-product layout remains the default. When one physical
`opendomain/` root must contain several independently owned products, add
`opendomain/governance.yaml`:

```yaml
schema_version: "1.0"
products:
  - id: public_api
    owners: [api-team]
    exposure: public
    dependencies: [shared_contracts]
    forbidden_dependencies: [desktop_private]
  - id: shared_contracts
    owners: [platform-team]
    exposure: public
    dependencies: []
    forbidden_dependencies: []
  - id: desktop_private
    owners: [desktop-team]
    exposure: private
    dependencies: [public_api]
    forbidden_dependencies: []
domain_groups:
  - id: public_api.core
    product: public_api
    source_root: products/public-api/core
    owners: [api-team]
    exposure: public
    dependencies: [shared_contracts.core]
    forbidden_dependencies: [desktop_private.context]
  - id: shared_contracts.core
    product: shared_contracts
    source_root: products/shared-contracts/core
    owners: [platform-team]
    exposure: public
    dependencies: []
    forbidden_dependencies: []
  - id: desktop_private.context
    product: desktop_private
    source_root: products/desktop-private/context
    owners: [desktop-team]
    exposure: private
    dependencies: [public_api.core]
    forbidden_dependencies: []
```

Each `source_root` contains the normal `contexts/`, `concepts/`, `rules/`,
`lifecycles/`, `events/`, and `candidates/` directories. Roots must be real,
disjoint directories confined to `opendomain/`; every governed semantic source
must belong to exactly one domain group.

Exposure is fixed from least to most restrictive:

```text
public < ecosystem < internal < private
```

A node may only depend on an equal or less restrictive target. Cross-product
group dependencies also require the corresponding product dependency.
`forbidden_dependencies` applies transitively and reports the dependency path.

Validate for humans or automation:

```bash
opendomain validate
opendomain validate --json
```

The JSON result adds `governance.dependency_graph` and
`governance.publication_closures`, including manifest provenance, included
nodes/files, and selection paths. Unknown schema versions/exposure values,
cycles, missing targets, overlaps, unassigned sources, forbidden paths, and
private-to-public leakage fail closed.

Publication closure is rebuildable static evidence. It does not publish a
repository, copy a public projection, grant access, modify Git, or prove that a
release occurred. The npm package and standalone executable evaluate the same
manifest without requiring EchoPath, AGW, a package-manager workspace, or a
private sibling repository. If `governance.yaml` is absent, current canonical,
legacy, and explicit-target behavior is unchanged.

## Embed Core And Export Context

Normal users can continue expressing intent to Codex. These interfaces are for
Agent hosts, plugins, CI, and maintainers that need an observable context payload.

Query current source without creating or reading a generated index:

```bash
opendomain query --id sales.order --json
opendomain query --context sales --type domain_concept --json
```

Export the selected accepted sources, their semantic closure, evidence, review,
source hashes, and related non-authoritative Candidate boundaries:

```bash
opendomain export context --id sales.order --json
```

Selectors are `--id`, `--context`, `--product`, `--domain-group`, `--owner`,
`--lifecycle`, and `--type`. Multiple selectors use logical AND. At least one is
required; an empty or unmatched request fails instead of exporting the whole
workspace.

In a governed canonical workspace, export one complete public proof with:

```bash
opendomain export context --product public_api --exposure public --json
```

Public export requires the current validated publication closure. It rejects an
ungoverned workspace, non-public product, invalid graph, stale source mapping,
or extra selector that would crop the proof. A passing payload is evidence only;
it does not copy files, change Git, grant access, or publish anything.

Node host and plugin authors may deliberately depend on the npm package and use
the side-effect-free Core API:

```js
import {
  CORE_API_VERSION,
  validateWorkspace,
  queryWorkspace,
  exportContext
} from "@echopath-labs/opendomain";

const context = await exportContext({
  cwd: process.cwd(),
  selector: { id: "sales.order" }
});
```

The package root and `@echopath-labs/opendomain/core` expose the same Core API
`1.0`. Calls return structured results and do not write stdout/stderr, set a
process exit code, create an index, mutate source, access Git/network, or manage
EchoPath lifecycle. `opendomain.context-export.v1` contains full accepted
Markdown content and workspace-relative provenance; Candidates remain only in
`candidate_boundaries` with `authoritative: false`.

Within Core v1, new named exports and optional result fields may be additive.
Removing fields, changing selector conjunction, weakening Candidate isolation,
or reinterpreting exposure proof requires a new API/export version and migration
guidance. Ordinary project installation should still follow the Agent
Installation Contract and must not add a host dependency merely to use the CLI.

## First Read-Only Domain Exploration

Ask:

> Explore the accepted business model for order cancellation. Do not modify
> anything. Show the relevant concepts, rules, lifecycles, evidence, Candidate
> boundaries, and model gaps.

Codex should validate the workspace, find the smallest relevant accepted source
set, read its evidence, and report Candidates separately. A useful result names:

- accepted IDs and source files read;
- durable rules or lifecycle constraints that affect the question;
- Candidate IDs and their current review states;
- missing, conflicting, or stale knowledge;
- confirmation that no domain files were modified.

## Brownfield Reverse Modeling

An existing project can adopt OpenDomain before it has a complete model. Start
with a read-only evidence pass:

> Inspect this existing project's product documentation, behavior, tests, code,
> APIs, and schemas. Do not modify anything yet. Propose the smallest useful
> bounded context and list which conclusions are direct evidence versus
> inference.

After a human confirms the evidence boundary and initial accepted scope, ask:

> Build the initial OpenDomain model for the agreed bounded context. Record
> stable, evidenced semantics in the appropriate model, and put every uncertain,
> inferred, or conflicting claim into a Candidate for human review.

Code, APIs, database schema, and tests are evidence, not accepted domain meaning
by themselves. Begin with one workflow that matters to implementation; do not
attempt to reverse-model the entire system in one pass.

If Assurance later reports `domain_model_gap`, Codex should explain which
required semantics are missing and propose evidence-backed Candidate work. A
model gap is an incomplete adoption state. Malformed declarations, broken IDs,
and accepted/Candidate boundary violations are integrity failures and remain
blocking.

## Review A Candidate

Ask:

> Review candidate-0001. Show its target, evidence, confidence, possible
> conflicts, and compatibility impact. Do not record a decision until I choose
> one.

Codex should inspect the Candidate and the accepted sources it may affect. The
human then explicitly chooses `accepted`, `rejected`, `superseded`, or
`deprecated`, together with reviewer identity and reason.

Only after that decision may Codex run a mutation such as:

```bash
opendomain candidate review candidate-0001 --decision rejected --reviewed-by chase --reason "Conflicts with confirmed order policy"
opendomain validate
```

An `accepted` Candidate review records attributable approval for promotion. It
keeps Candidate `status` and `review.state` as `proposed`, so grounding still
reports it as non-authoritative. It never rewrites accepted knowledge.

After a human has authored or updated the accepted target source, use the
non-applying plan to validate the exact target and review its SHA-256 digest:

```bash
opendomain candidate promote plan candidate-0001 --accepted-source opendomain/concepts/sales.order.md --json
```

Only after a second human confirmation may OpenDomain record completion:

```bash
opendomain candidate promote complete candidate-0001 --accepted-source opendomain/concepts/sales.order.md --confirmed-by chase --reason "Confirmed the final accepted source and evidence" --json
```

Completion changes only the Candidate to `superseded` and records the accepted
target path and digest. It does not create or edit accepted source content.
Update and deprecation Candidates also require `--compatibility-note` during
planning and completion.

A human-authored source document with `status: proposed` is a deliberate draft
of that source type. Agent-extracted or uncertain semantics belong in a
`domain_candidate`. Neither is accepted knowledge until the normal human source
review and the separate Candidate promotion boundary have been satisfied.

## Ground An Implementation Task

Ask:

> Implement this change. Before modifying behavior, classify whether long-lived
> domain semantics are involved, run OpenDomain Assurance against the applicable
> source unit, read every accepted source it lists, and report Candidate
> boundaries separately.

For task-scoped grounding, the Agent supplies one OpenDomain Grounding Request
v1 file. No planning tool or Integration Profile is required. Save a JSON or YAML
request, for example `grounding-request.yaml`:

```yaml
protocol_version: "1.0"
source:
  type: agent
  path: work-notes.md
intent:
  id: work.current-task
  name: Current task
  status: proposed
grounding:
  status: unclassified
affects_domain:
  concepts: []
  rules: []
  lifecycles: []
  events: []
```

Replace the work identity and source locator with the actual task. `source.type`
is a descriptive label; OpenDomain does not interpret another tool's workflow.
`source.path` is metadata and is not opened to infer IDs or select a model root.
The four `affects_domain` lists reference existing accepted OpenDomain IDs, not
copies of business definitions. Choose `required` and fill the relevant IDs when
business constraints apply. Use `not_required` only with a non-empty `rationale`
and empty ID lists. If uncertain, keep `unclassified`; the example intentionally
reports incomplete grounding until classified. Missing `grounding` remains a
warned v1 compatibility case and is never silently treated as `not_required`.

Run from the project owning the OpenDomain model:

```bash
opendomain prepare --request grounding-request.yaml --json
opendomain assure --request grounding-request.yaml
```

Pass exactly one `.json`, `.yaml` or `.yml` file. `--request` cannot be combined
with a positional source, `--integration` or `--profile`. OpenDomain safely parses
the declaration and rereads the current model; caller-provided `read_first`,
`policy`, adapter metadata and other result fields are not preparation evidence.
Exploring or organizing the business model does not require a planning task.


Assurance separates the Grounding Request, preparation state, and policy
outcome:

| Grounding state | Meaning |
| --- | --- |
| `required` | The work is constrained by accepted domain semantics. |
| `not_required` | Domain grounding is explicitly unnecessary and has a rationale. |
| `unclassified` | Evidence is not yet sufficient to decide. |

| Preparation | Advisory | Enforced |
| --- | --- | --- |
| `prepared` or valid `not_required` | pass | pass |
| `domain_model_gap` or `unclassified` | warn | fail |
| malformed input, contradiction, or broken reference | fail | fail |

The completion report should name accepted IDs and source paths, Candidate
boundaries, Assurance mode and outcome, and any unresolved model gap. Assurance
evaluates current declarations and evidence; it does not prove Agent
comprehension.

## Optional Compatibility Inputs

OpenSpec, Spec Kit and other planning tools are usage scenarios, not prerequisites.
Agents using any tool can supply the native request above without changing that
tool's documents. OpenDomain defines the request contract, not external directory
layouts or planning processes.

Existing OpenSpec `feature_spec` inputs and repository-local Profiles remain
supported through positional source inputs and `--integration openspec` or
`--profile <id>`. A legacy directory must contain exactly one valid compatible
declaration; ordinary Markdown needs no metadata. Malformed YAML headers or
multiple declarations are rejected; a plain delta file is not redirected to a
parent declaration. New consumers should use the native request entry.

Profile v1 still normalizes classification to `unclassified`; it does not map
an explicit grounding decision. Use native requests for explicit classification
instead of adding a Profile just to use OpenDomain. This release does not add
or claim a verified Spec Kit integration.

## Diagnose And Recover

Missing declarations mean request preparation has not completed, not that the
business model is unavailable. Provide a native request using the example above;
do not add front matter to every planning document. Repair malformed input,
select one declaration for ambiguous legacy input, and correct broken references
using existing accepted IDs. Do not create accepted knowledge merely to pass a check.


| Symptom | Action |
| --- | --- |
| `opendomain` is not found | Ask Codex to follow the installation contract and report its chosen user-owned install path. |
| `doctor` reports missing or stale managed files | Inspect ownership conflicts, then run `update`; do not overwrite user-owned Skills. |
| Both `opendomain/` and `domain/` exist | Use canonical `opendomain/`; migrate intentionally because roots are never merged. |
| Assurance reports `domain_model_gap` | Review missing semantics and create evidence-backed Candidates incrementally. |
| Enforced Assurance rejects `unclassified` | Classify the request with evidence or keep the workflow advisory while modeling. |
| Profile selection is ambiguous | Select one Profile explicitly or narrow the Profile match declaration. |
| Candidate is stale | Review, add evidence, reject, supersede, or deprecate it; do not treat age as acceptance. |

Run these checks after repair:

```bash
opendomain doctor --json
opendomain validate --json
```

## CLI Appendix

Direct commands are useful for CI, diagnostics, and maintainers. Normal users
can continue expressing intent to Codex.

| Goal | Command |
| --- | --- |
| Initialize Codex integration | `opendomain init --tools codex` |
| Synchronize managed resources | `opendomain update` |
| Diagnose integration | `opendomain doctor` |
| Validate current workspace | `opendomain validate` |
| List accepted IDs | `opendomain ids list` |
| Check references | `opendomain refs check` |
| List Candidates | `opendomain candidate list` |
| Inspect one Candidate | `opendomain candidate show <candidate-id>` |
| Prepare a Grounding Pack | `opendomain prepare --request <file>` |
| Run advisory Assurance | `opendomain assure --request <file>` |
| Run enforced Assurance | `opendomain assure --request <file> --mode enforced --json` |
| Inspect Profiles | `opendomain integrations list` |
| Validate Profiles | `opendomain integrations validate` |
| Build a derived index | `opendomain index build` |
| Query a domain ID | `opendomain index query <domain-id>` |
| Query current source | `opendomain query --id <domain-id>` |
| Export accepted context | `opendomain export context --id <domain-id> --json` |
| Export a public closure | `opendomain export context --product <product-id> --exposure public --json` |

## ERP Example

The [ERP example](examples/erp/README.md) demonstrates one accepted order model,
one Candidate, OpenSpec grounding, and a generic structured-source Profile. It
is synthetic learning material, not a complete ERP ontology.

Public project entrypoints: [README](README.md), [Contributing](CONTRIBUTING.md),
[Security](SECURITY.md), and [Changelog](CHANGELOG.md).
