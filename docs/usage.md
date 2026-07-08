# OpenDomain 使用说明

本文是 OpenDomain 的第一版使用说明。它面向两类读者：

- Human maintainer：维护领域模型、审查 Candidate、决定什么可以成为 accepted knowledge。
- Codex / AI agent：在修改代码或规划 Feature 前，快速找到并读取相关业务语义。

OpenDomain 当前仍是 MVP 工具链，后续会随着格式、命令、审查流程和索引能力继续迭代。

## 1. OpenDomain 解决什么问题

OpenDomain 用 Git 中的 Markdown 文件沉淀长期业务语义：

- 业务概念是什么，不是什么
- 概念属于哪个 bounded context
- 概念之间有什么关系
- 哪些业务规则长期成立
- 对象有哪些生命周期
- 哪些业务事件表示已经发生的事实
- 哪些证据支持这些知识
- 哪些知识已经 accepted，哪些仍只是 proposed Candidate

OpenDomain 不替代 OpenSpec。

```text
OpenDomain
  长期业务语义：业务世界是什么，哪些规则长期成立

OpenSpec
  变更交付语义：这次为什么改、要交付什么、如何验收

EchoPath
  Agent 执行连续性：如何恢复、交接、保留执行上下文
```

判断一条知识放在哪里时，优先使用这条规则：

```text
如果一条知识在当前 Feature 结束后仍长期成立，它更可能属于 OpenDomain。
如果一条知识只解释某次变更的动机、设计、任务或验收，它属于 OpenSpec。
```

## 2. 快速开始

OpenDomain 的 npm 包名是 `@echopath-labs/opendomain`，CLI 命令是 `opendomain`。

全局安装 CLI：

```bash
npm install -g @echopath-labs/opendomain
opendomain init
opendomain validate domain
```

也可以在仓库源码中直接运行 CLI。

查看可用命令：

```bash
npm run opendomain -- help
```

初始化一个项目：

```bash
npm run opendomain -- init
```

复制 ERP 示例：

```bash
npm run opendomain -- init --example erp
```

验证所有 OpenDomain 文件：

```bash
npm run opendomain -- validate
```

验证一个示例领域：

```bash
npm run opendomain -- validate examples/erp
```

运行 MVP grounding demo：

```bash
npm run demo
```

运行测试：

```bash
npm test
```

## 3. 推荐仓库结构

OpenDomain 默认使用 Git 中的 Markdown + YAML front matter。

```text
domain/
  contexts/
  concepts/
  rules/
  lifecycles/
  events/
  candidates/

openspec/
  changes/
  specs/

docs/
examples/
schemas/
```

当前仓库里：

- `domain/` 是 OpenDomain 自己的真实业务模型。
- `examples/erp/` 是 ERP Order Cancellation 示例。
- `openspec/changes/` 保存变更计划、任务和验收要求。
- `docs/` 保存产品说明、架构说明和使用说明。

首次在自己的仓库中使用时，建议先读 [快速上手](getting-started.md)。

## 4. 如何写领域模型

### 4.1 Bounded Context

Bounded Context 用来限制概念成立的业务语境。

示例：

```yaml
---
type: bounded_context
id: sales
name: Sales
status: accepted
evidence:
  - type: human_review
    location: examples/erp/README.md
    summary: Sales context is accepted for the ERP example.
    confidence: high
review:
  state: accepted
  reviewed_by: sales-domain-owner
  reviewed_at: 2026-07-07
---
```

### 4.2 Domain Concept

Domain Concept 表示长期稳定的业务概念。

必须尽量写清楚：

- `context`
- `status`
- `aliases`
- `not_synonyms`
- `related`
- `rules`
- `lifecycles`
- `events`
- `evidence`
- `review`

示例：

```yaml
---
type: domain_concept
id: sales.order
name: Order
context: sales
status: accepted
aliases:
  - Sales Order
not_synonyms:
  - Invoice
rules:
  - sales.confirmed-order-cannot-be-deleted
lifecycles:
  - sales.order-lifecycle
events:
  - sales.order-confirmed
evidence:
  - type: human_review
    location: examples/erp/domain/contexts/sales.md
    summary: Order is accepted as the central Sales concept.
    confidence: high
review:
  state: accepted
  reviewed_by: sales-domain-owner
  reviewed_at: 2026-07-07
---
```

正文建议只写三类内容：

- `Business Meaning`：它是什么
- `Not This`：它不是什么
- `Agent Guidance`：Codex 修改相关代码前必须注意什么

### 4.3 Business Rule

Business Rule 表示长期成立的业务约束、不变量或政策。

示例：

```yaml
---
type: business_rule
id: sales.confirmed-order-cannot-be-deleted
name: Confirmed order cannot be deleted directly
context: sales
status: accepted
applies_to:
  - sales.order
severity: must
rule_type: invariant
evidence:
  - type: human_review
    location: examples/erp/domain/concepts/sales.order.md
    summary: Confirmed order deletion is treated as a stable invariant.
    confidence: high
review:
  state: accepted
  reviewed_by: sales-domain-owner
  reviewed_at: 2026-07-07
---
```

### 4.4 Lifecycle

Lifecycle 表示领域对象的状态和迁移。

重点字段：

- `applies_to`
- `states`
- `transitions`
- `forbidden_transitions`
- `related_rules`

Validator 会检查状态引用、重复状态和 terminal state 的普通 outgoing transition。

### 4.5 Domain Event

Domain Event 表示业务上已经发生的事实，不是消息队列事件的简单复制。

示例：

```yaml
---
type: domain_event
id: sales.order-confirmed
name: Order Confirmed
context: sales
status: accepted
past_tense_name: OrderConfirmed
occurs_when: A submitted order is approved and enters Confirmed state.
applies_to:
  - sales.order
related_lifecycle:
  - sales.order-lifecycle
evidence:
  - type: human_review
    location: examples/erp/domain/lifecycles/sales.order-lifecycle.md
    summary: The lifecycle emits OrderConfirmed when the order enters Confirmed.
    confidence: high
review:
  state: accepted
  reviewed_by: sales-domain-owner
  reviewed_at: 2026-07-07
---
```

## 5. Candidate 工作流

AI 推断出来的新领域知识默认写成 Domain Candidate，不直接写入 accepted knowledge。

Candidate 适合记录：

- 从代码、API、DB、测试、OpenSpec、ADR 中发现的可能业务规则
- 不确定的新生命周期状态
- 可能的概念关系
- 证据冲突
- 需要领域 owner 判断的内容

最小 Candidate 示例：

```yaml
---
type: domain_candidate
id: candidate-0001-order-lifecycle
status: proposed
proposed_change_type: update_lifecycle
target:
  type: lifecycle
  id: sales.order-lifecycle
confidence: medium
extracted_by: codex
extracted_at: 2026-07-07
evidence:
  - type: spec
    location: examples/erp/domain/lifecycles/sales.order-lifecycle.md
    summary: Accepted lifecycle does not include Closed state.
    confidence: medium
possible_conflicts:
  - Existing accepted lifecycle does not include Closed.
review:
  state: proposed
  suggested_reviewer: sales-domain-owner
---
```

Candidate 不是 accepted truth。人类审查后，可以选择：

- 拒绝 Candidate
- 要求补证据
- 标记 superseded / deprecated
- 手动把被接受的语义写入正式 OpenDomain 文件，并保留 evidence 和 review metadata

常用 Candidate 审查命令：

```bash
npm run opendomain -- candidate list examples/erp
npm run opendomain -- candidate show candidate-0001-order-lifecycle examples/erp
npm run opendomain -- candidate review candidate-0001-order-lifecycle --decision rejected --reviewed-by sales-domain-owner --reason "Closed is not part of the accepted lifecycle." examples/erp
```

`candidate review` 只更新 Candidate 文件的 review metadata，不会自动修改
accepted OpenDomain 文件。选择 `--decision accepted` 时，Candidate 会记录为
`superseded`，然后由人类把被接受的语义手动写入目标 domain source file。

## 6. OpenSpec 如何引用 OpenDomain

OpenSpec 描述一次变更为什么存在、要交付什么、如何验收。

如果一个 Feature 会影响领域语义，Feature spec 应该通过 `affects_domain` 引用 OpenDomain ID：

```yaml
---
type: feature_spec
id: spec.order-cancellation
name: Order cancellation
status: proposed
affects_domain:
  concepts:
    - sales.order
  rules:
    - sales.confirmed-order-cannot-be-deleted
  lifecycles:
    - sales.order-lifecycle
  events:
    - sales.order-confirmed
---
```

OpenSpec 不应该复制 `sales.order` 的定义。它只引用 ID，然后解释本次变更。

## 7. Codex 修改代码前怎么读 OpenDomain

Codex 的默认入口是 `opendomain prepare`。

```bash
npm run opendomain -- prepare examples/erp/openspec/changes/order-cancellation/spec.md
```

OpenDomain 会自动识别 OpenSpec-style feature spec。你也可以显式指定
built-in OpenSpec integration：

```bash
npm run opendomain -- prepare --integration openspec examples/erp/openspec/changes/order-cancellation/spec.md
```

当前 MVP 只支持 `openspec` built-in integration。Spec Kit 或其他工具的
Integration Profile 仍处于设计阶段，不会执行动态插件代码。

输出会包含：

- `Read first`：必须先读的 accepted OpenDomain source files
- `Candidate boundaries`：相关 proposed Candidate，不能当作 accepted truth
- `Avoided semantic errors`：实现时应避免的业务语义错误

JSON 输出还会包含 `grounding_request`，用于表示外部 spec 被适配成的中立
grounding input。它不是 source of truth，只是 grounding pack 的输入。

Codex 在最终回复中应报告：

```text
Domain Grounding Used:
- sales.order
- sales.order-lifecycle
- sales.confirmed-order-cannot-be-deleted

Candidate Boundary:
- candidate-0001-order-lifecycle remains proposed
```

## 8. Semantic Retrieval Index

Semantic Retrieval Index 是派生视图，用来帮 Codex 和人类低成本找到该读的 OpenDomain 文件。

构建 index：

```bash
npm run opendomain -- index build examples/erp --out /tmp/erp-index.json
```

按 domain ID 查询：

```bash
npm run opendomain -- index query sales.order --index /tmp/erp-index.json
```

按 context 查询：

```bash
npm run opendomain -- index query --context sales --index /tmp/erp-index.json
```

Index query 返回的是 read-first plan：

- `read_first`
- `accepted_ids`
- `candidate_boundaries`
- `verify_with`
- stale warning

Index 不是 source of truth。它只回答“应该读哪些 source files”。重要语义仍必须回到 Git 中的 OpenDomain Markdown 文件确认。

## 9. 常用命令

| 目标 | 命令 |
|---|---|
| 查看帮助 | `npm run opendomain -- help` |
| 初始化 OpenDomain 目录 | `npm run opendomain -- init` |
| 复制 ERP 示例 | `npm run opendomain -- init --example erp` |
| 验证全部 OpenDomain 文件 | `npm run opendomain -- validate` |
| 验证指定目录 | `npm run opendomain -- validate examples/erp` |
| 输出 JSON 验证结果 | `npm run opendomain -- validate examples/erp --json` |
| 为 Feature 准备 grounding | `npm run opendomain -- prepare <feature-spec-or-dir>` |
| 显式使用 OpenSpec integration | `npm run opendomain -- prepare --integration openspec <feature-spec-or-dir>` |
| 列出 Candidate | `npm run opendomain -- candidate list examples/erp` |
| 查看 Candidate | `npm run opendomain -- candidate show <candidate-id> examples/erp` |
| 记录 Candidate review | `npm run opendomain -- candidate review <candidate-id> --decision rejected --reviewed-by <name> --reason <text> examples/erp` |
| 列出 ID | `npm run opendomain -- ids list examples/erp` |
| 检查引用 | `npm run opendomain -- refs check examples/erp` |
| 构建 index | `npm run opendomain -- index build examples/erp --out /tmp/erp-index.json` |
| 查询 ID | `npm run opendomain -- index query sales.order --index /tmp/erp-index.json` |
| 查询 context | `npm run opendomain -- index query --context sales --index /tmp/erp-index.json` |
| 运行 demo | `npm run demo` |
| 运行测试 | `npm test` |
| 验证 OpenSpec | `npm run openspec:validate` |

## 10. 审查规则

Accepted knowledge 必须有：

- evidence
- review metadata
- human reviewer
- stable ID
- 明确 context

AI 可以提出 Candidate，但不能静默提升为 accepted。

如果修改 accepted knowledge，应同时说明：

- 为什么要改
- 证据是什么
- 是否影响现有 Feature / Rule / Lifecycle
- 是否需要兼容说明

## 11. 不要这样用

不要把 OpenDomain 当成：

- OpenSpec 的复制品
- 数据库 schema 文档
- 长篇业务百科
- 未经审查的 AI memory
- 自动接受 AI 推断的知识库
- graph database 或 index 的 source of truth

也不要在 OpenSpec 里重复定义 OpenDomain 概念。OpenSpec 应该引用 OpenDomain ID。

## 12. 当前限制

当前版本仍然是 MVP：

- Candidate promotion 仍是人工流程。
- Index 是基于现有 OpenDomain 文件生成的 read-first index，不是 embedding search。
- 还没有 graph export、MCP server、IDE 插件或审查 UI。
- Validator 已覆盖基础结构、引用、review、Candidate 和 lifecycle 规则，但不是完整语义推理器。

这些限制是刻意保留的。当前优先级是让 Git source、validation、Candidate boundary、OpenSpec grounding 和 read-first index 先稳定。

## 13. 推荐工作流

新增或修改业务能力时：

1. 在 OpenSpec 写 Feature intent、task 和 acceptance。
2. 用 `affects_domain` 引用相关 OpenDomain IDs。
3. 运行 `opendomain prepare`。
4. Codex 读取 `Read first` 中的 accepted source files。
5. 如果发现不确定的长期语义，写 Candidate。
6. 运行 `opendomain validate` 和测试。
7. 人类审查 Candidate，再决定是否提升为 accepted knowledge。

长期维护时：

1. 定期查询 index 或 `ids list` 找到相关 domain files。
2. 清理 stale Candidate。
3. 把被反复引用、长期成立的语义沉淀为 accepted OpenDomain。
4. 把一次性设计动机保留在 OpenSpec 或 ADR，不写进 OpenDomain。
