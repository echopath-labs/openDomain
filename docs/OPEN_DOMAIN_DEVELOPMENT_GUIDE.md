---
title: OpenDomain Development Guide for Codex
doc_type: codex_development_guide
project: OpenDomain
audience: Codex / AI coding agents / human maintainers
status: draft
version: 0.1.0
language: zh-CN
---

# OpenDomain Development Guide for Codex

> 本文档用于指导 Codex 开发 OpenDomain。  
> 它不是产品宣传稿，也不是最终规范，而是 Codex 在仓库中执行设计、编码、重构、测试、文档与候选领域知识提炼时必须遵循的开发手册。

---

## 0. 使用方式

建议将本文档放在仓库中：

```text
docs/OPEN_DOMAIN_DEVELOPMENT_GUIDE.md
```

并在仓库根目录 `AGENTS.md` 中加入类似指令：

```md
# AGENTS.md

Before working on OpenDomain, read:

- docs/OPEN_DOMAIN_DEVELOPMENT_GUIDE.md

Follow that guide for product boundaries, development order, domain modeling rules, candidate generation, validation, and review expectations.
```

如果本文件与更具体的任务说明冲突，优先级如下：

```text
用户当前任务说明
  > 更靠近当前目录的 AGENTS.md
  > 仓库根目录 AGENTS.md
  > 本开发指南
  > Codex 的一般默认行为
```

---

## 1. Codex 的角色

Codex 在 OpenDomain 项目中的角色不是单纯“写代码”。

Codex 应被视为：

```text
Domain Semantic Infrastructure Co-Developer
```

也就是：

> 与人类维护者一起设计并实现一个 Git Native、AI Maintainable、Evidence-backed 的领域语义层。

Codex 的目标不是快速生成大量文件，而是逐步建立一个能被长期维护的开放格式与工具链。

Codex 必须始终围绕以下问题开发：

> AI Agent 在长期软件演进中，需要什么样的领域知识载体，才能稳定理解业务世界、减少误解、支持审查、支持演进，并能跨项目、跨工具共享？

---

## 2. OpenDomain 的产品定义

OpenDomain 的一句话定义：

> OpenDomain 是面向 AI Agent 的、Git 原生的、证据驱动的领域语义层，用于持续沉淀软件系统中的长期业务知识。

英文表达：

> OpenDomain is a Git-native, evidence-backed, AI-maintainable domain semantic layer for software systems.

OpenDomain 关注的是：

```text
Business Knowledge / Domain Knowledge
```

它回答：

> 业务世界是什么？  
> 哪些概念长期存在？  
> 它们之间是什么关系？  
> 哪些业务规则和不变量必须长期成立？

OpenDomain 不应该被实现为单纯的文档模板，也不应该被实现为传统 Ontology 平台的轻量复制品。

它的核心价值是：

```text
让 AI Agent 能够持续、可信、可追溯地理解业务世界。
```

---

## 3. 与 OpenSpec / EchoPath 的边界

Codex 必须始终维护以下知识分层：

```text
OpenDomain
  Stable Business Semantics
  说明业务世界是什么，哪些规则长期成立

OpenSpec
  Change Intent & Delivery Specification
  说明为什么发生变化，这次要如何交付

EchoPath
  Agent Execution Continuity
  说明 Agent 如何执行、恢复、交接、沉淀经验
```

### 3.1 OpenDomain 管什么

OpenDomain 管长期稳定的业务语义，例如：

- Customer 是什么
- Order 是什么
- Supplier 与 Product 的关系
- Warehouse 与 Inventory 的关系
- Machine、Work Order、Operation、Routing 的关系
- Order 的生命周期
- Invoice 的法律/业务含义
- 已确认订单是否允许删除
- 已投产工单是否允许修改 BOM

### 3.2 OpenSpec 管什么

OpenSpec 管项目变化，例如：

- Feature
- Requirement
- Design
- Task
- ADR
- Acceptance Criteria
- 某次需求为什么要做
- 某次交付如何验收
- 某个技术决策为什么被选择

### 3.3 EchoPath 管什么

EchoPath 管 Agent 执行连续性，例如：

- Session
- Context
- Recovery
- Handoff
- Memory Candidate
- 执行过程中的失败、恢复、交接与上下文沉淀

### 3.4 归属判断规则

Codex 在新增或修改内容时，使用以下判断：

```text
如果一条知识描述“业务世界长期是什么”，放入 OpenDomain。
如果一条知识描述“这次为什么要改、怎么交付”，放入 OpenSpec。
如果一条知识描述“Agent 如何完成工作、如何恢复上下文”，放入 EchoPath。
```

示例：

| 内容 | 归属 | 原因 |
|---|---|---|
| Order 有 Draft、Submitted、Confirmed、Cancelled、Fulfilled 状态 | OpenDomain | 生命周期知识，长期成立 |
| 本次新增“订单取消时释放库存”功能 | OpenSpec | 某次功能变更 |
| 为什么选择异步释放库存 | OpenSpec / ADR | 项目决策 |
| Codex 本轮修改了哪些文件、测试如何恢复 | EchoPath | 执行过程知识 |
| Customer 和 Account 不是同义词 | OpenDomain | 关键业务语义 |

---

## 4. OpenDomain 的非目标

Codex 不要把 OpenDomain 做成以下东西。

### 4.1 不做 OpenSpec 的领域版

OpenDomain 不是：

```text
Feature / Requirement / Task / ADR 的另一种写法
```

OpenDomain 应被设计成被 OpenSpec 引用，而不是替代 OpenSpec。

### 4.2 不做传统 Ontology 平台

OpenDomain 可以借鉴 Ontology 的思想，但不要默认要求团队使用：

- OWL
- RDF
- SPARQL
- Reasoner
- 图数据库
- 重型知识工程平台

这些可以作为未来导出格式或高级能力，但不应成为 MVP 的默认入口。

### 4.3 不做数据库 Schema 复刻

数据库表不是领域模型。

`customer` 表、`account` 表、`party` 表、`crm_customer` 表可能都与 Customer 有关，但 OpenDomain 要描述业务含义，不是复制 DDL。

### 4.4 不做百科

OpenDomain 不是给人写长篇业务百科。

它应该对人可读，但首先要对 Agent 可消费。

每条知识都应帮助 Agent 判断：

- 这个概念是什么
- 不是什么
- 属于哪个业务上下文
- 与哪些概念有关
- 有哪些业务规则
- 有哪些生命周期
- 哪些证据支持它
- 改动它会影响什么

### 4.5 不做未经审查的 AI Memory

OpenDomain 不是 Agent 的随手笔记。

AI 发现的新领域知识，默认只能进入 Candidate，不得直接进入 accepted knowledge。

---

## 5. 设计原则

### 5.1 Git Native

OpenDomain 的 source of truth 必须可以直接存放在 Git 仓库中。

要求：

- 不依赖数据库才能存在
- 不依赖中心化平台才能 review
- 支持 Pull Request
- 支持 Diff
- 支持分支、回滚、历史追踪
- 支持代码所有权与审查流程

### 5.2 Markdown First, Structured Enough

OpenDomain 应该优先采用 Markdown + 结构化元数据。

推荐初期形态：

```text
Markdown body
YAML front matter
JSON Schema / YAML Schema validation
```

原则：

```text
Human can review it.
Agent can parse it.
Git can diff it.
Tooling can validate it.
```

### 5.3 AI First

OpenDomain 的首要消费者是 AI Agent，而不是人类读者。

因此 Codex 在设计格式时，必须优先考虑：

- 可解析性
- 稳定 ID
- 明确关系
- 可追溯证据
- 可验证约束
- 可检索结构
- 可用于影响分析
- 可用于代码生成前的语义 grounding

### 5.4 Human Review

AI 可以：

- 逆向分析
- 提炼候选知识
- 更新草案
- 检测冲突
- 生成证据链
- 提出重构建议

但 Verified Domain Knowledge 必须由人类确认。

### 5.5 Evidence-backed

每条重要领域知识都应该有来源。

来源可以是：

- Spec
- ADR
- Code
- API
- Database Schema
- Test
- Commit
- User Story
- 人类确认记录

Codex 在新增知识时必须回答：

> 你凭什么这么说？

没有证据的内容不得直接进入 accepted 状态。

### 5.6 Living Model

OpenDomain 是持续演进的模型，不是一次性建模产物。

Codex 应支持：

- 新增知识
- 修正知识
- 废弃知识
- 标记冲突
- 追踪来源
- 记录 review
- 生成候选更新

### 5.7 Small Core, Derived Views

OpenDomain 的 Git 文件是 source of truth。

其他形态是派生视图，例如：

- Knowledge Graph
- Embedding Index
- Search Index
- MCP Resource
- HTML 文档站点
- IDE 插件视图
- Ontology/RDF/OWL 导出

Codex 不要先构建重型平台。

正确顺序：

```text
格式核心
  ↓
示例
  ↓
Schema
  ↓
Validator
  ↓
CLI
  ↓
Candidate workflow
  ↓
OpenSpec integration
  ↓
Derived graph/index/export
```

---

## 6. 核心语义对象

OpenDomain 的最小核心不应太大。

MVP 至少应包含以下对象。

### 6.1 Bounded Context

表示一个领域概念在哪个业务上下文中成立。

示例：

- Sales
- Procurement
- Inventory
- Manufacturing
- Finance
- CRM
- MES
- WMS

Codex 必须避免把同名概念跨上下文混为一谈。

例如：

```text
Account in CRM != Account in IAM != Account in Finance
```

### 6.2 Domain Concept

表示长期稳定的业务概念。

示例：

- Customer
- Order
- Supplier
- Product
- Warehouse
- Machine
- Work Order
- Invoice

Domain Concept 应至少包含：

- stable id
- name
- bounded context
- definition
- non-goals / not synonyms
- aliases
- relationships
- rules
- lifecycle references
- evidence
- review status

### 6.3 Relationship

表示概念之间的业务关系。

示例：

```text
Customer places Order
Order contains OrderLine
Product is stored in Warehouse
WorkOrder consumes Material
Machine performs Operation
```

Relationship 应尽量使用明确谓词，而不是模糊的“related_to”。

### 6.4 Lifecycle

表示领域对象的状态与状态迁移。

示例：

```text
Draft -> Submitted -> Confirmed -> Fulfilled
Confirmed -> Cancelled
Fulfilled -> Closed
```

Lifecycle 应包含：

- states
- transitions
- allowed triggers
- forbidden transitions
- terminal states
- related rules

### 6.5 Business Rule

表示业务规则、不变量、约束或例外。

示例：

```text
A confirmed order cannot be deleted directly.
Inventory quantity must not become negative.
A released work order cannot change its routing without approval.
```

Rule 应尽量可被验证或用于测试生成。

### 6.6 Domain Event

表示业务上已经发生的事实。

示例：

- OrderSubmitted
- OrderConfirmed
- InventoryReserved
- InvoiceIssued
- WorkOrderReleased
- MachineStopped

Domain Event 不是技术消息队列事件的简单复制。

它首先表达业务事实，其次才映射到代码/API/消息。

### 6.7 Evidence / Provenance

表示领域知识的来源。

Evidence 是 OpenDomain 的可信基础。

每条 Evidence 至少应包含：

- type
- location
- summary
- confidence
- extracted_by
- extracted_at

来源类型示例：

```text
code
api
database
spec
adr
test
commit
human_review
```

### 6.8 Domain Candidate

AI 提炼出的待审核领域知识。

Candidate 是 OpenDomain 的关键对象。

Codex 发现新知识时，默认生成 Candidate，而不是直接修改 accepted knowledge。

Candidate 应包含：

- candidate id
- proposed change type
- target concept/rule/context
- proposed content
- evidence
- confidence
- possible conflicts
- suggested reviewer
- review decision

### 6.9 Review State

推荐状态：

```text
proposed
accepted
rejected
superseded
deprecated
```

状态含义：

| 状态 | 含义 |
|---|---|
| proposed | AI 或人类提出，尚未确认 |
| accepted | 已被人类确认，可作为可信领域知识 |
| rejected | 已拒绝，不应被 Agent 当作真相 |
| superseded | 被新知识替代，保留历史 |
| deprecated | 仍可追溯，但不建议继续使用 |

---

## 7. 推荐仓库结构

Codex 在 Greenfield 开发时，可采用以下结构作为初始建议。

如果仓库已有约定，优先遵循现有约定。

```text
.
├── AGENTS.md
├── README.md
├── docs/
│   ├── OPEN_DOMAIN_DEVELOPMENT_GUIDE.md
│   ├── vision.md
│   ├── glossary.md
│   ├── architecture.md
│   └── decisions/
│       └── ADR-0001-git-native-markdown-first.md
├── domain/
│   ├── contexts/
│   │   └── sales.md
│   ├── concepts/
│   │   └── sales.order.md
│   ├── rules/
│   │   └── sales.confirmed-order-cannot-be-deleted.md
│   ├── lifecycles/
│   │   └── sales.order-lifecycle.md
│   ├── events/
│   │   └── sales.order-confirmed.md
│   └── candidates/
│       └── candidate-0001-order-lifecycle.md
├── schemas/
│   ├── opendomain.schema.json
│   ├── concept.schema.json
│   ├── rule.schema.json
│   ├── lifecycle.schema.json
│   └── candidate.schema.json
├── examples/
│   ├── erp/
│   ├── mes/
│   └── crm/
├── src/
│   ├── parser/
│   ├── validator/
│   ├── cli/
│   ├── extractor/
│   ├── exporter/
│   └── indexer/
├── tests/
│   ├── fixtures/
│   ├── validator/
│   └── cli/
└── package-or-build-files
```

---

## 8. 文件格式基线

Codex 不要一开始追求完美 DSL。

推荐先采用：

```text
Markdown + YAML front matter
```

### 8.1 Domain Concept 示例

```md
---
type: domain_concept
id: sales.order
name: Order
context: sales
status: accepted
version: 1
aliases:
  - Sales Order
not_synonyms:
  - Invoice
  - Shipment
owners:
  - sales-domain-owner
related:
  - type: contains
    target: sales.order_line
  - type: placed_by
    target: sales.customer
rules:
  - sales.confirmed-order-cannot-be-deleted
lifecycles:
  - sales.order-lifecycle
evidence:
  - type: code
    location: src/sales/orders/Order.ts
    summary: Order aggregate root used by sales order workflow.
    confidence: medium
  - type: spec
    location: specs/order-cancellation/spec.md
    summary: Cancellation flow assumes order lifecycle states.
    confidence: high
review:
  state: accepted
  reviewed_by: human
  reviewed_at: 2026-06-27
---

# Order

An Order represents a customer's commercial request to purchase products or services.

## Business meaning

An Order is created in the Sales context and tracks the commercial lifecycle before fulfillment and invoicing.

## Not this

- An Order is not an Invoice.
- An Order is not a Shipment.
- An Order is not a shopping cart unless the Sales context explicitly defines it that way.

## Agent guidance

Before modifying order-related code, check:

- `sales.order-lifecycle`
- `sales.confirmed-order-cannot-be-deleted`
- related inventory reservation rules
```

### 8.2 Business Rule 示例

```md
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
  - type: test
    location: tests/sales/order-delete.test.ts
    summary: Test expects deletion of confirmed order to fail.
    confidence: high
review:
  state: accepted
  reviewed_by: sales-domain-owner
  reviewed_at: 2026-06-27
---

# Confirmed order cannot be deleted directly

A confirmed order cannot be physically deleted by normal business operations.

It may only be cancelled, closed, or corrected through approved business flows.

## Agent guidance

Do not implement direct deletion APIs for confirmed orders unless a new accepted domain rule supersedes this rule.
```

### 8.3 Domain Candidate 示例

```md
---
type: domain_candidate
id: candidate-0001-order-lifecycle
status: proposed
proposed_change_type: add_lifecycle
target:
  type: lifecycle
  id: sales.order-lifecycle
confidence: medium
extracted_by: codex
extracted_at: 2026-06-27
evidence:
  - type: code
    location: src/sales/orders/order-status.ts
    summary: OrderStatus enum contains Draft, Submitted, Confirmed, Cancelled, Fulfilled.
    confidence: high
  - type: api
    location: api/sales/orders.yaml
    summary: Cancel endpoint only accepts Submitted or Confirmed orders.
    confidence: medium
possible_conflicts:
  - Existing documentation mentions Closed state but code does not expose it.
review:
  state: proposed
  suggested_reviewer: sales-domain-owner
---

# Candidate: Order lifecycle

Codex found evidence that Order may have the following lifecycle:

```text
Draft -> Submitted -> Confirmed -> Fulfilled
Submitted -> Cancelled
Confirmed -> Cancelled
Fulfilled -> Closed?
```

## Reasoning summary

The code and API indicate a stable sales order lifecycle, but the `Closed` state is uncertain because it appears in documentation but not in current code.

## Requested human review

Please confirm whether `Closed` is a valid terminal state.
```

---

## 9. 开发路线图

Codex 应采用小步迭代，不要一次性构建完整平台。

### Milestone 0: 项目骨架与产品边界

目标：让仓库清楚表达 OpenDomain 是什么，不是什么。

交付物：

- `README.md`
- `AGENTS.md`
- `docs/vision.md`
- `docs/OPEN_DOMAIN_DEVELOPMENT_GUIDE.md`
- `docs/architecture.md`
- 最小 examples 目录

验收标准：

- 新 Agent 进入仓库后能在 5 分钟内理解产品边界
- 文档明确区分 OpenDomain / OpenSpec / EchoPath
- 文档明确非目标

### Milestone 1: 格式最小核心

目标：定义最小可用的 OpenDomain 文件格式。

交付物：

- `concept.schema.json`
- `rule.schema.json`
- `lifecycle.schema.json`
- `event.schema.json`
- `candidate.schema.json`
- ERP / MES / CRM 示例

验收标准：

- 每个示例都能通过 schema validation
- 每个对象都有 stable id
- 每条 accepted 知识都有 review 信息
- 每条重要知识都能挂 evidence

### Milestone 2: Parser 与 Validator

目标：让 OpenDomain 从“文档约定”变成“可验证格式”。

交付物：

- Markdown front matter parser
- Schema validator
- Cross-reference validator
- CLI command: `opendomain validate`
- 测试用例与 fixtures

验收标准：

- 无效 front matter 能报错
- 缺失 id / type / context / status 能报错
- 断开的 relationship / rule / lifecycle reference 能报错
- duplicate id 能报错
- 错误信息能定位文件和字段

### Milestone 3: Candidate Workflow

目标：建立 AI 提炼领域知识的安全路径。

交付物：

- Candidate 文件格式
- CLI command: `opendomain candidate validate`
- Candidate review 状态转换规则
- 示例：从代码/API/Spec 提炼 Candidate
- 文档：`docs/candidate-workflow.md`

验收标准：

- Codex 发现新知识时能生成 Candidate
- Candidate 不会自动变成 accepted
- Candidate 必须包含 evidence
- 人类可以接受、拒绝或要求修改 Candidate

### Milestone 4: OpenSpec Integration

目标：让 OpenSpec 引用 OpenDomain，而不是复制领域知识。

交付物：

- Spec 引用 Domain Concept / Rule / Lifecycle 的约定
- 示例 Feature Spec
- CLI check: Spec 中引用的 Domain ID 必须存在

验收标准：

- 一个 Feature 能声明 affected domain concepts
- 一个 ADR 能引用相关 domain rule
- 一个 Task 能要求 Codex 在修改前读取相关 domain files

### Milestone 5: Derived Graph / Index

目标：从 Git 文件生成派生视图，辅助 Agent 检索和影响分析。

交付物：

- Export JSON graph
- Export concept map
- Basic impact analysis
- Optional MCP resource design draft

验收标准：

- Graph 是派生物，不是 source of truth
- 删除 graph 后可从 Git 文件重建
- Agent 能查询某个 concept 关联的 rules / lifecycle / evidence

### Milestone 6: Ecosystem / Standardization

目标：探索 OpenDomain 成为跨 Agent 业务语义共享格式。

交付物：

- Versioning policy
- Compatibility policy
- Export format design
- Agent consumption protocol draft
- Community examples

验收标准：

- 旧版本文件可迁移
- 不同工具能消费同一套 OpenDomain 文件
- OpenDomain 可作为 Agent 间共享语义 payload

---

## 10. Codex 每次任务的标准工作流

Codex 在处理任何 OpenDomain 任务前，应执行以下流程。

### 10.1 开始前

1. 阅读当前任务说明。
2. 阅读最近的 `AGENTS.md`。
3. 阅读本开发指南。
4. 检查相关文档、schema、examples、tests。
5. 判断任务类型：
   - 产品定义
   - 格式设计
   - schema
   - parser
   - validator
   - CLI
   - examples
   - docs
   - tests
   - extractor / candidate workflow
   - OpenSpec integration
6. 给出简短计划。

### 10.2 开发中

Codex 应遵守：

- 优先实现最小垂直切片
- 不做无关重构
- 不引入重型平台依赖
- 所有格式变更必须同步更新 schema 和 examples
- 所有 validator 行为必须有测试
- 所有 CLI 行为必须有可复现实例
- 所有文档中的示例都应尽量可验证

### 10.3 修改领域知识时

Codex 必须遵守：

```text
accepted knowledge 不得被 AI 静默改写。
新发现的领域知识默认进入 candidate。
对 accepted knowledge 的修改必须说明原因、证据和兼容影响。
```

### 10.4 结束前

Codex 应检查：

- 是否更新了相关测试
- 是否更新了相关文档
- 是否保持示例可通过校验
- 是否破坏了已有 schema
- 是否引入未说明的格式变更
- 是否把 Candidate 错误地提升为 accepted
- 是否保留了 evidence 和 review 信息

最终回复应包含：

- 改了什么
- 为什么改
- 如何验证
- 仍有哪些未决问题

---

## 11. Codex 的逆向分析工作流

当用户要求 Codex 从既有系统中提炼领域知识时，Codex 不要直接写 accepted domain files。

应按以下流程：

```text
选择分析范围
  ↓
读取代码 / API / DB / Spec / ADR / Test
  ↓
识别候选概念、关系、规则、生命周期、事件
  ↓
与现有 OpenDomain 对比
  ↓
生成 Domain Candidate
  ↓
附带 evidence、confidence、possible conflicts
  ↓
等待 Human Review
```

### 11.1 证据强度建议

| 来源 | 说明 | 建议置信度 |
|---|---|---|
| 人类确认 | 明确业务 owner 确认 | high |
| 测试 | 测试体现明确业务约束 | high / medium |
| ADR | 说明领域或架构决策 | high / medium |
| OpenSpec | 说明某次需求与验收 | medium |
| 代码 | 可能反映真实行为，也可能是历史残留 | medium |
| API | 反映外部契约，但不总是完整领域模型 | medium |
| DB Schema | 有价值，但不能直接等同领域模型 | low / medium |
| Commit message | 可作为辅助证据 | low / medium |

### 11.2 冲突处理

如果 Codex 发现冲突，不要自行解决。

应生成 Candidate 并标记：

- conflict_with
- evidence_for
- evidence_against
- suggested_resolution
- review_required

---

## 12. Validator 应检查的内容

OpenDomain validator 至少应检查：

### 12.1 基础结构

- front matter 存在
- `type` 合法
- `id` 存在且格式合法
- `name` 存在
- `status` 合法
- `context` 存在或可解析

### 12.2 ID 与引用

- ID 全局唯一
- 引用对象存在
- relationship target 存在
- rule applies_to 存在
- lifecycle reference 存在
- event reference 存在

### 12.3 Review 与状态

- accepted 必须有 review 信息
- rejected 必须有 reason
- superseded 必须指向替代对象
- deprecated 必须有说明
- proposed 不得被当作 accepted source

### 12.4 Evidence

- accepted 的关键知识必须有 evidence 或 human_review
- evidence type 合法
- evidence location 格式合法
- confidence 合法

### 12.5 语义一致性

初期可以做轻量检查：

- lifecycle states 不重复
- transition 引用的 state 必须存在
- terminal state 不应有普通 outgoing transition
- relationship predicate 不应为空
- concept 不应把自身作为直接 target，除非显式允许
- duplicate alias 警告
- possible synonym conflict 警告

---

## 13. CLI 设计原则

OpenDomain CLI 应该简单、确定、适合 CI。

推荐命令：

```bash
opendomain validate
opendomain validate domain/concepts/sales.order.md
opendomain graph export --format json
opendomain candidate validate
opendomain ids list
opendomain refs check
opendomain doctor
```

CLI 输出原则：

- 错误必须包含文件路径
- 错误必须包含字段路径
- 错误必须说明如何修复
- 默认输出适合人阅读
- 提供 `--json` 适合机器消费
- CI 中非零退出码表示失败

---

## 14. 测试原则

Codex 必须把 OpenDomain 当作格式与工具链项目来测试。

至少应包含：

- valid fixtures
- invalid fixtures
- schema tests
- parser tests
- validator tests
- CLI tests
- example validation tests
- cross-reference tests
- candidate workflow tests

每当新增格式能力，必须新增：

```text
一个正例
一个反例
一个 validator 测试
一段文档说明
```

---

## 15. 与 DDD / Ontology / Knowledge Graph 的关系

Codex 可以借鉴成熟思想，但不得让 OpenDomain 被其复杂度吞没。

### 15.1 借鉴 DDD

可借鉴：

- Bounded Context
- Ubiquitous Language
- Entity
- Value Object
- Aggregate
- Domain Event
- Invariant
- Policy
- Lifecycle

但 OpenDomain 不是 DDD 模板集合。

OpenDomain 的核心读者是 Agent，目标是让 Agent 稳定理解业务语义。

### 15.2 借鉴 Ontology

可借鉴：

- concept
- relation
- class
- property
- constraint
- equivalence
- hierarchy
- namespace

但 OpenDomain 不要求用户直接维护 OWL/RDF。

未来可以支持导出，但不要让导出格式决定核心体验。

### 15.3 借鉴 Knowledge Graph

可借鉴：

- 节点
- 边
- 图遍历
- 影响分析
- 语义检索
- 路径解释

但 source of truth 必须仍然是 Git 中的 OpenDomain 文件。

正确模型：

```text
OpenDomain files in Git
  ↓
Generated graph / index / search / MCP resources
```

---

## 16. OpenSpec Integration 规则

Codex 在设计 OpenSpec 集成时，应遵守：

```text
OpenSpec 引用 OpenDomain。
OpenSpec 不复制 OpenDomain。
```

示例：

```md
---
type: feature_spec
id: spec.order-cancellation
affects_domain:
  concepts:
    - sales.order
    - inventory.stock_reservation
  rules:
    - sales.confirmed-order-cannot-be-deleted
  lifecycles:
    - sales.order-lifecycle
---

# Order cancellation

This feature allows users to cancel eligible sales orders and release reserved inventory.
```

Codex 在实现 OpenSpec feature 时，应先读取 `affects_domain` 中引用的 OpenDomain 文件。

---

## 17. Agent Consumption 设计方向

OpenDomain 不只是文件格式，还应成为 Agent 可消费的语义资源。

未来应支持：

- Codex 在修改代码前自动读取相关 domain files
- Agent 根据 Spec 找到 affected domain concepts
- Agent 根据代码路径找到相关 domain context
- Agent 根据业务规则生成测试建议
- Agent 在发现领域变化后生成 Candidate
- 多个 Agent 共享同一套业务语义

潜在接口：

```text
Git files
CLI
JSON export
MCP resource
IDE extension
A2A semantic payload
```

但 Codex 不要在 MVP 阶段过早实现所有接口。

---

## 18. 开发禁止事项

Codex 不得：

1. 把 OpenDomain 做成 OpenSpec 的复制品。
2. 把数据库表直接转成领域模型并标记为 accepted。
3. 未经 review 就把 AI 推断写入 accepted knowledge。
4. 一开始就引入图数据库作为 source of truth。
5. 一开始就设计复杂 DSL。
6. 写大量自然语言百科而缺少结构化字段。
7. 使用不稳定 ID，例如依赖标题自动生成 ID 后又随标题变化。
8. 修改 schema 后不更新 examples。
9. 修改 examples 后不更新 validator tests。
10. 让 derived graph/index 成为真相来源。
11. 隐式改变语义状态，例如 proposed 自动等于 accepted。
12. 在没有 evidence 的情况下声称某条业务规则是事实。

---

## 19. Codex 可使用的任务模板

### 19.1 初始化仓库

```text
Read docs/OPEN_DOMAIN_DEVELOPMENT_GUIDE.md.
Initialize the OpenDomain repository with the smallest useful structure.
Create README, AGENTS.md, docs/vision.md, schemas placeholders, and one ERP example.
Do not implement a graph database or heavy platform.
Make sure all examples are consistent with the product boundary.
```

### 19.2 新增 schema

```text
Read docs/OPEN_DOMAIN_DEVELOPMENT_GUIDE.md.
Add or update the schema for <object type>.
Update valid and invalid fixtures.
Update validator tests.
Update documentation examples if the format changed.
Do not break existing accepted examples unless you also provide a migration note.
```

### 19.3 新增 validator 能力

```text
Read docs/OPEN_DOMAIN_DEVELOPMENT_GUIDE.md.
Implement validation for <rule>.
Add tests for valid and invalid cases.
Ensure CLI errors include file path, field path, and suggested fix.
Keep output deterministic and CI-friendly.
```

### 19.4 从代码提炼领域候选

```text
Read docs/OPEN_DOMAIN_DEVELOPMENT_GUIDE.md.
Analyze the specified code/API/schema/spec scope.
Do not modify accepted domain knowledge directly.
Generate Domain Candidate files with evidence, confidence, and possible conflicts.
Summarize what needs human review.
```

### 19.5 集成 OpenSpec

```text
Read docs/OPEN_DOMAIN_DEVELOPMENT_GUIDE.md.
Add a minimal convention for OpenSpec files to reference OpenDomain concepts, rules, and lifecycles.
Add one example Feature Spec.
Add validation that referenced OpenDomain IDs exist.
Do not duplicate domain definitions inside OpenSpec.
```

---

## 20. Greenfield 技术栈建议

如果仓库是空的，且用户没有指定技术栈，Codex 可以优先提出以下 baseline：

```text
TypeScript / Node.js for CLI and validator
JSON Schema for machine validation
Markdown + YAML front matter for source files
Vitest or equivalent for tests
```

理由：

- 适合快速实现 CLI 与 schema validation
- 生态中 Markdown/YAML/JSON Schema 工具丰富
- 易于被前端、后端、CI、文档站点消费
- 对开放格式项目的早期迭代成本较低

但 Codex 不得把该建议当作不可变规则。

如果仓库已有 Rust、Go、Python、Java 等技术栈，应优先遵循仓库现实。

---

## 21. 最小成功标准

OpenDomain 的 MVP 成功标准不是“文档看起来完整”。

而是：

```text
Agent 能读懂它。
Human 能审查它。
Git 能追踪它。
Tooling 能验证它。
Spec 能引用它。
Candidate 能安全演进它。
```

MVP 至少应证明：

1. 能表达一个 ERP Order 领域概念。
2. 能表达 Order 生命周期。
3. 能表达一条业务不变量。
4. 能表达一个 Domain Event。
5. 能表达一个 AI 提出的 Candidate。
6. 能通过 validator 检查格式和引用。
7. 能让一个 OpenSpec feature 引用相关领域知识。
8. 能说明哪些内容是 accepted，哪些只是 proposed。

---

## 22. 长期愿景

OpenDomain 的长期方向不是成为一个文档工具，而是成为 AI 软件工程中的业务语义基础层。

它应逐步支持：

- 从既有工程资产中提炼领域知识
- 由人类审查并确认
- 与 OpenSpec 形成变化闭环
- 与 EchoPath 形成执行闭环
- 为 Codex 和其他 Agent 提供业务 grounding
- 支持跨项目、跨工具的领域语义共享
- 支持派生 Knowledge Graph，但不依赖它
- 支持导出到 Ontology / RDF / JSON Graph，但不强迫团队维护它们

最终目标：

> 让 Agent 不再每次都从代码和数据库中重新猜测业务世界，而是基于一套可信、可追溯、持续演进的领域语义层进行软件开发。

---

## 23. 当前推荐的第一项开发任务

如果 Codex 第一次进入 OpenDomain 仓库，建议从以下任务开始：

```text
Read docs/OPEN_DOMAIN_DEVELOPMENT_GUIDE.md.
Create the initial OpenDomain repository skeleton.
Do not implement a heavy platform.
Create:
- README.md
- AGENTS.md
- docs/vision.md
- docs/architecture.md
- docs/candidate-workflow.md
- schemas/concept.schema.json
- schemas/rule.schema.json
- schemas/lifecycle.schema.json
- schemas/candidate.schema.json
- examples/erp/domain/concepts/sales.order.md
- examples/erp/domain/rules/sales.confirmed-order-cannot-be-deleted.md
- examples/erp/domain/lifecycles/sales.order-lifecycle.md
- examples/erp/domain/candidates/candidate-0001-order-lifecycle.md

Keep schemas minimal but valid.
Make examples human-readable and machine-parseable.
Add a README section explaining OpenDomain / OpenSpec / EchoPath boundaries.
```

---

## 24. Codex 的最终行为准则

Codex 开发 OpenDomain 时，始终记住：

```text
OpenDomain is not documentation for humans only.
OpenDomain is not a knowledge graph platform first.
OpenDomain is not OpenSpec rewritten with domain nouns.
OpenDomain is not AI memory without review.

OpenDomain is a Git-native domain semantic contract
between business reality, software assets, human reviewers, and AI agents.
```

