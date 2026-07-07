# MVP Grounding Demo

This demo proves the first OpenDomain MVP loop:

```text
OpenSpec-style feature with affects_domain
  -> Agent locates OpenDomain files
  -> Agent reads accepted semantics
  -> uncertain knowledge remains a Candidate
  -> validator checks references and review boundaries
```

## Scenario

The demo feature is:

```text
examples/erp/openspec/changes/order-cancellation/spec.md
```

It references these OpenDomain IDs:

- `sales.order`
- `sales.order-lifecycle`
- `sales.confirmed-order-cannot-be-deleted`
- `sales.order-confirmed`

The avoided business semantic error is:

```text
Do not add direct deletion behavior for confirmed orders.
Use cancellation semantics and keep uncertain Closed lifecycle evidence as a
Candidate until human review.
```

## Commands

Run all tests:

```bash
npm test
```

Validate the ERP example:

```bash
npm run opendomain -- validate examples/erp
```

Prepare the Codex grounding pack for the feature:

```bash
npm run opendomain -- prepare examples/erp/openspec/changes/order-cancellation/spec.md
```

Validate with machine-readable output:

```bash
npm run opendomain -- validate examples/erp --json
```

Prepare with machine-readable output:

```bash
npm run opendomain -- prepare examples/erp/openspec/changes/order-cancellation/spec.md --json
```

List known IDs:

```bash
npm run opendomain -- ids list examples/erp
```

Build and query a Semantic Retrieval Index:

```bash
npm run opendomain -- index build examples/erp --out /tmp/erp-index.json
npm run opendomain -- index query sales.order --index /tmp/erp-index.json
```

Run the grounding demo:

```bash
npm run demo
```

Run OpenSpec validation:

```bash
npm run openspec:validate
```

## MVP Boundary

The CLI validates the boundary between accepted and proposed knowledge.

It does not automatically promote Candidate content to accepted OpenDomain
knowledge. Human review remains required.

## Codex Protocol

Before implementing a non-trivial feature spec, Codex should run:

```bash
npm run opendomain -- prepare <feature-spec-or-dir>
```

Codex should then:

1. Read the `Read first` files.
2. Treat `Candidate boundaries` as proposed knowledge only.
3. Avoid broad repository scans unless the grounding pack is insufficient.
4. Include `Domain Grounding Used` in the final response.

Example:

```text
Domain Grounding Used:
- sales.order
- sales.order-lifecycle
- sales.confirmed-order-cannot-be-deleted

Candidate Boundary:
- candidate-0001-order-lifecycle remains proposed
```
