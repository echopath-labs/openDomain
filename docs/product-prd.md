---
title: OpenDomain MVP PRD
doc_type: product_prd
project: OpenDomain
status: draft
version: 0.1.0
updated_at: 2026-06-30
language: zh-CN
---

# OpenDomain MVP PRD

## 1. 背景

AI Agent 正在越来越多地参与软件系统的长期演进，但 Agent 对业务世界的理解通常来自临时读取代码、数据库、接口、Spec、文档和聊天上下文。

这种方式有几个问题：

- 代码和数据库结构不等于业务语义。
- 不同 Agent 会反复猜测同一批领域概念。
- 业务规则和生命周期容易被埋在实现细节里。
- AI 推断出来的“知识”缺少证据、状态和人类审查边界。
- OpenSpec 能说明一次变更为什么发生，但不应该承载长期业务语义本身。

OpenDomain 要解决的是：让软件系统中的长期业务知识以 Git 原生、可审查、可验证、可被 Agent 消费的方式持续沉淀。

MVP 不能只证明“这些文件能被校验”。MVP 必须证明：

```text
OpenDomain 能让 Agent 在一次真实 Feature 中少犯一个可解释的业务语义错误。
```

## 1.1 MVP 要防止的真实错误

OpenDomain MVP 优先防止三类 Agent 错误：

1. 把实现结构误认为业务语义。
   例如把数据库表 `crm_customer`、`party`、`account` 直接当成稳定的 Customer 领域模型。
2. 忽略长期业务规则。
   例如实现订单删除接口时忘记 `confirmed order cannot be deleted directly`。
3. 把一次 Feature 的设计选择误认为永久业务规则。
   例如把“本次为了兼容旧 API 返回 409”写成长期领域规则。

如果 MVP 不能展示至少一类错误如何被避免，OpenDomain 就只是更结构化的文档。

## 2. 产品定义

OpenDomain 是面向 AI Agent 的、Git 原生的、证据驱动的领域语义层，用于持续沉淀软件系统中的长期业务知识。

它回答：

- 业务世界里有哪些长期概念？
- 这些概念属于哪个 bounded context？
- 它们之间有什么关系？
- 哪些规则和不变量长期成立？
- 对象有哪些生命周期？
- 哪些业务事实会以 Domain Event 形式发生？
- 哪些证据支持这些知识？
- 哪些知识是 accepted，哪些只是 proposed？

## 2.1 MVP 产品断言

OpenDomain 的第一个产品断言是：

```text
当 OpenSpec 声明一个 Feature 影响哪些 OpenDomain ID 时，Agent 能在实现前读取相关 accepted knowledge，并在发现不确定知识时生成 Candidate，而不是修改 accepted knowledge。
```

这个断言比“schema 能通过”更重要。schema、validator、CLI 都服务于这个 grounding 闭环。

## 3. 核心判断

OpenDomain 与 OpenSpec 的边界采用以下判断：

```text
如果一条知识在当前 Feature 结束后仍长期成立，它更可能属于 OpenDomain。
如果一条知识只解释某次变更的动机、设计、任务或验收，它属于 OpenSpec。
```

补充治理规则：

```text
AI can propose.
Human must accept.
```

AI 推断出来的领域知识默认进入 Domain Candidate，不直接进入 accepted knowledge。

## 4. 目标用户

### 4.1 Primary User: AI Coding Agent

Agent 在修改系统前，需要快速找到相关领域概念、业务规则、生命周期和证据，避免只根据代码结构猜业务含义。

#### 4.1.1 Agent 可读性约束

OpenDomain 的 MVP 设计必须优先让 Codex 读得稳定：

- 入口必须确定，例如 `affects_domain`、Grounding Pack 或派生索引。
- 读取范围必须小，默认只读相关 accepted source files。
- 关系必须显式，不能依赖长篇自然语言暗示。
- Candidate 必须作为 proposed boundary 呈现，不能混入 accepted truth。
- 索引只能帮助“找到文件”，不能替代 Git 中的 OpenDomain source of truth。

### 4.2 Primary User: Human Maintainer

维护者需要审查 AI 提出的领域知识，判断其是否真实、长期成立、是否应该进入 accepted OpenDomain。

### 4.3 Secondary User: Product / Domain Owner

业务负责人需要以较低成本审查关键概念、规则和生命周期，而不是阅读完整代码或工具内部数据。

### 4.4 Secondary User: Tool Builder

工具开发者需要一个稳定、开放、Git-native 的格式，用来构建 validator、CLI、索引、图谱、MCP resource 或 IDE 插件。

## 5. MVP 目标

MVP 的目标不是做一个完整知识图谱平台，也不是只证明格式能被校验。

MVP 要证明这条 Agent 业务语义 grounding 闭环成立：

```text
OpenSpec feature with affects_domain
  ↓
Agent locates OpenDomain files
  ↓
Agent reads accepted concepts, rules, lifecycles, events, evidence, review state
  ↓
Agent uses accepted knowledge while implementing or planning
  ↓
Agent discovers uncertain knowledge
  ↓
Agent creates Domain Candidate instead of changing accepted knowledge
  ↓
Validator checks format, references, evidence, and review state
  ↓
Human accepts, rejects, or requests changes
```

MVP 成功标准：

- Agent 能从 OpenSpec `affects_domain` 找到 OpenDomain 文件。
- Agent 能读懂 accepted OpenDomain 文件并解释要遵守的业务语义。
- Agent 能在不确定时生成 Candidate，而不是污染 accepted knowledge。
- Human 能在 5 分钟内判断一个 Candidate 是否值得接受、拒绝或补证据。
- Git 能追踪 OpenDomain 变化。
- Tooling 能验证格式和引用。
- OpenSpec 能引用 OpenDomain ID。
- Candidate 能安全承载 AI 推断知识，并且不会无限堆积成不可审查的垃圾区。

## 6. MVP 范围

### 6.1 Source Format

OpenDomain MVP 使用 Markdown + YAML front matter。

必须支持：

- bounded context
- domain concept
- business rule
- lifecycle
- domain event
- domain candidate
- evidence
- review state

### 6.2 Schema

MVP 必须提供 JSON Schema，用于校验对象基础结构。

最低要求：

- `type`
- `id`
- `name`
- `context`，如果对象类型需要 context
- `status`
- `evidence`
- `review`
- 对象类型特定字段

### 6.3 Parser

MVP 必须提供 Markdown front matter parser。

Parser 需要：

- 读取 `.md` 文件
- 解析 YAML front matter
- 保留文件路径
- 暴露正文内容
- 对缺失或非法 front matter 给出可定位错误

### 6.4 Validator

MVP 必须提供 validator。

Validator 至少检查：

- front matter 存在
- `type` 合法
- `id` 格式合法且全局唯一
- 必填字段存在
- accepted knowledge 必须有 evidence 和 human review metadata
- relationship / rule / lifecycle / event 引用存在
- lifecycle transition 引用已定义 state
- terminal state 不应有普通 outgoing transition
- proposed candidate 不得被当作 accepted source

### 6.5 CLI

MVP 必须提供确定、CI-friendly 的 CLI。

优先命令：

```bash
opendomain validate
opendomain validate <path>
opendomain ids list
opendomain refs check
opendomain candidate validate
```

CLI 错误必须包含：

- file path
- field path
- problem
- suggested fix

### 6.6 Candidate Workflow

MVP 必须把 AI 推断知识放入 Candidate。

Candidate 必须包含：

- candidate id
- proposed change type
- target object
- proposed content
- evidence
- confidence
- possible conflicts
- suggested reviewer
- review state

Candidate 不会自动变成 accepted knowledge。

### 6.7 OpenSpec Integration

MVP 必须允许 OpenSpec 引用 OpenDomain。

OpenSpec 可声明：

```yaml
affects_domain:
  concepts:
    - sales.order
  rules:
    - sales.confirmed-order-cannot-be-deleted
  lifecycles:
    - sales.order-lifecycle
```

OpenSpec 不复制 OpenDomain 定义。

### 6.8 First Demonstration Scenario

MVP 第一条演示闭环使用 ERP Order Cancellation，而不是抽象 hello world。

演示必须包含：

- OpenSpec feature：订单取消。
- `affects_domain` 引用：
  - `sales.order`
  - `sales.order-lifecycle`
  - `sales.confirmed-order-cannot-be-deleted`
- Agent 修改前读取这些 OpenDomain 文件。
- Agent 发现 `Closed` 状态不确定时创建 Candidate。
- Validator 确认 accepted knowledge 和 proposed Candidate 的边界。
- Human reviewer 手动接受、拒绝或要求补证据。

第二个格式压力测试应覆盖跨上下文同名概念：

```text
Account in CRM != Account in IAM != Account in Finance
```

这个测试用于证明 OpenDomain 不把同名词跨 bounded context 混为一谈。

## 7. 非目标

MVP 不做：

- 图数据库 source of truth
- OWL / RDF / SPARQL 默认入口
- 复杂 DSL
- SaaS 协作平台
- 自动把 AI 推断提升为 accepted
- 数据库 schema 到 domain model 的直接转换
- 长篇百科式业务文档
- IDE 插件
- MCP server
- embedding search
- 可视化图谱编辑器

这些能力可以作为后续 derived views 或生态能力探索。

## 8. 关键用户流程

### 8.1 Agent 修改 Feature 前读取领域语义

1. Agent 读取 OpenSpec change。
2. OpenSpec change 声明 `affects_domain`。
3. Agent 根据 ID 找到 OpenDomain 文件。
4. Agent 读取相关 concept、rule、lifecycle、event。
5. Agent 在实现和测试中遵守 accepted knowledge。

### 8.2 Agent 发现新领域知识

1. Agent 从代码、API、DB schema、tests、OpenSpec 或 ADR 发现可能的领域知识。
2. Agent 不直接修改 accepted domain files。
3. Agent 创建 Domain Candidate。
4. Candidate 包含 evidence、confidence 和 possible conflicts。
5. Human reviewer 决定接受、拒绝或要求修改。

### 8.3 Human 审查 Candidate

1. Reviewer 打开 Candidate 文件。
2. Reviewer 检查 proposed content 和 evidence。
3. Reviewer 判断这条知识在当前 Feature 结束后是否长期成立。
4. Reviewer 接受、拒绝、标记 superseded / deprecated，或要求补充证据。
5. Accepted 知识进入正式 OpenDomain 文件并保留 review metadata。

### 8.4 CI 校验 OpenDomain

1. Pull Request 修改 domain、schemas、examples 或 OpenSpec references。
2. CI 运行 `opendomain validate`。
3. Validator 检查格式、schema、引用、状态和 evidence。
4. 错误输出可定位到文件和字段。

### 8.5 MVP 演示闭环

1. Human 创建或打开 OpenSpec change：订单取消。
2. OpenSpec change 通过 `affects_domain` 声明受影响的 OpenDomain ID。
3. Agent 根据这些 ID 读取 Order 概念、生命周期、确认订单不可直接删除规则和相关事件。
4. Agent 规划实现时明确不能新增直接删除 confirmed order 的路径。
5. Agent 从代码或文档中发现 `Closed` 状态可能存在，但 accepted lifecycle 没有它。
6. Agent 创建 `Closed` 状态 Candidate，而不是直接修改 accepted lifecycle。
7. Validator 检查 Candidate 有 evidence、confidence、review state 和 target。
8. Human reviewer 决定是否接受 `Closed` 状态。
9. 后续 Agent 只能把 accepted lifecycle 当作可信语义来源。

### 8.6 Human Review 最小动作

MVP 阶段不做复杂 review UI，也不要求 CLI 自动 promotion。

Human reviewer 的最小动作是：

1. 在 PR 或本地 diff 中打开 Candidate。
2. 阅读 proposed content、evidence、confidence、possible conflicts。
3. 判断该知识在当前 Feature 结束后是否仍长期成立。
4. 手动修改 review state，或把 accepted 知识写入正式 OpenDomain 文件。
5. 保留 reviewer、reviewed_at、evidence 和兼容影响说明。

CLI 在 MVP 阶段只负责校验，不负责自动把 Candidate 提升为 accepted。

### 8.7 Candidate Staleness

Candidate 不能无限堆积。

MVP 默认治理规则：

```text
Candidate 超过 30 天无人处理，应被 validator 或 doctor 命令标记为 stale warning。
```

stale Candidate 不是自动 rejected，但 Agent 不应把它当作可信语义来源。

## 9. 开发阶段

### Phase 0: Product Boundary And PRD

目标：明确 OpenDomain 是什么、不是什么，以及 MVP 如何验收。

交付：

- `docs/product-prd.md`
- OpenSpec change for PRD planning
- 明确 OpenDomain / OpenSpec / EchoPath 边界

验收：

- PRD 说明目标用户、MVP 范围、非目标、用户流程、阶段和验收标准。
- OpenSpec change 能说明本次 PRD 规划为什么存在。

### Phase 1: Format Core

目标：让核心对象格式稳定下来。

交付：

- schema 收敛
- ERP Order Cancellation grounding 示例补齐
- `Closed` 状态不确定性的 Candidate 示例
- CRM / IAM / Finance `Account` 跨上下文歧义示例草案
- 格式文档

验收：

- 每个对象类型都有正例。
- accepted 示例都有 evidence 和 review。
- proposed 示例不会被当作 accepted。
- 示例能展示至少一类 Agent 业务语义错误如何被避免。

### Phase 2: Parser And Validator

目标：让 OpenDomain 从文档约定变成可验证格式。

交付：

- parser
- schema validator
- cross-reference validator
- test fixtures
- CLI `opendomain validate`

验收：

- 无效 front matter 报错。
- duplicate id 报错。
- broken reference 报错。
- lifecycle state/transition 错误可被发现。
- 错误包含 file path、field path 和 suggested fix。

### Phase 3: Candidate Workflow

目标：建立 AI 提炼领域知识的安全路径。

交付：

- Candidate validation
- Candidate review state rules
- 示例 Candidate
- `docs/candidate-workflow.md` 更新

验收：

- Candidate 必须包含 evidence。
- Candidate 不会自动变成 accepted。
- human review 是 accepted promotion 的必要条件。

### Phase 4: OpenSpec Integration

目标：让 OpenSpec 引用 OpenDomain。

交付：

- `affects_domain` convention
- Order Cancellation Feature spec 示例
- OpenSpec reference check

验收：

- OpenSpec 中引用的 OpenDomain ID 必须存在。
- OpenSpec 不复制 concept / rule / lifecycle 定义。
- Agent 能从 `affects_domain` 定位到相关 OpenDomain 文件。

### Phase 5: Derived Views

目标：从 Git source 生成派生视图。

交付：

- JSON graph export
- concept map export
- basic impact analysis

验收：

- derived graph 删除后可从 Git 文件重建。
- Agent 能查询 concept 关联的 rules / lifecycles / evidence。

## 10. 验收标准

MVP 完成时必须满足：

- `opendomain validate` 能校验示例和真实 domain 文件。
- 至少一个 ERP Order Cancellation 示例包含 context、concept、rule、lifecycle、event、candidate。
- 至少一个 OpenSpec feature 通过 `affects_domain` 引用 OpenDomain ID。
- Agent 能基于 `affects_domain` 读取相关 OpenDomain 文件，并说明一个应避免的业务语义错误。
- accepted knowledge 必须有 evidence 和 review metadata。
- AI-inferred knowledge 必须先进入 Candidate。
- Candidate 超过 30 天无人处理时有 stale warning 策略。
- 文档明确说明 OpenDomain / OpenSpec / EchoPath 边界。
- 测试覆盖 parser、schema validation、cross-reference validation、CLI 和 candidate workflow。

## 10.1 MVP 失败标准

满足以下任一情况，应承认 MVP 没有成立：

- Agent 仍然无法从 OpenSpec change 自动定位相关 OpenDomain 文件。
- Validator 只能检查 front matter，不能发现断裂引用、状态治理错误或 accepted-without-review。
- Human reviewer 无法在 5 分钟内判断一个 Candidate 是否值得接受、拒绝或补证据。
- Candidate 数量增长，但 accepted knowledge 没有增长，说明 review loop 失败。
- OpenDomain 文件被当成普通 docs 写，Agent 不能稳定解析。
- 同一业务规则仍然在多个 OpenSpec change 中重复定义并发生漂移。
- MVP demo 不能展示一个具体业务语义错误如何被避免。

## 11. 指标

### 11.1 Functional Metrics

- valid fixtures pass rate: 100%
- invalid fixtures caught rate: 100% for covered validation rules
- duplicate id detection: supported
- broken reference detection: supported
- accepted-without-review detection: supported
- candidate-without-evidence detection: supported

### 11.2 Agent Utility Metrics

- Agent can locate affected domain files from an OpenSpec reference.
- Agent can summarize a concept with its rules, lifecycle, events, evidence, and review state.
- Agent can generate a Candidate instead of directly changing accepted knowledge.
- Agent can explain which semantic error was avoided in the Order Cancellation demo.
- Agent can distinguish accepted lifecycle states from proposed lifecycle candidates.

### 11.3 Review Metrics

- Reviewer can determine why a domain claim exists by reading evidence.
- Reviewer can distinguish accepted knowledge from proposed knowledge.
- Reviewer can see compatibility impact when accepted knowledge changes.
- Reviewer can complete a simple Candidate decision in 5 minutes.

## 12. 主要风险

### 12.1 过早平台化

风险：把 OpenDomain 过早做成图数据库、Ontology 平台或可视化系统。

控制：MVP source of truth 只使用 Git 文件。

### 12.2 OpenSpec 与 OpenDomain 混淆

风险：把 Feature、Task、ADR 当成领域知识写入 OpenDomain。

控制：使用“Feature 结束后是否长期成立”的判断规则。

### 12.3 AI Memory 污染 Accepted Knowledge

风险：AI 推断内容未经审查直接进入 accepted。

控制：Candidate 是默认入口，human review 是 promotion gate。

### 12.4 过度自然语言化

风险：文件变成人读百科，Agent 难以解析。

控制：Markdown 正文可以解释，但 front matter 必须结构化；默认读取路径应先给 Codex 小型 grounding/index 摘要，再指向可追溯的 accepted source files。

### 12.5 Validator 只做 schema 不做语义引用

风险：schema 通过但引用断裂、生命周期错误、状态治理错误。

控制：Phase 2 必须实现 cross-reference validation。

### 12.6 Candidate 堆积

风险：AI 生成大量 Candidate，但无人 review，最终 Candidate 变成噪音。

控制：MVP 引入 stale warning；无 suggested reviewer、无 evidence、超过 30 天无人处理的 Candidate 不应进入 Agent 默认语义上下文。

### 12.7 MVP 只证明工具链，不证明产品价值

风险：项目完成 parser、schema、CLI，但无法展示 Agent 实际避免了什么业务语义错误。

控制：MVP 必须包含 Order Cancellation grounding demo，并要求 Agent 解释避免的语义错误。

## 13. MVP 默认决策

这些决策作为当前 PRD 的工作默认值，后续可以通过 OpenSpec 变更修订。

- 技术栈默认使用 TypeScript / Node.js，除非后续实现发现明显不适合。
- CLI 包名默认使用 `opendomain`，npm package 是否 scoped 后续再定。
- Candidate promotion 在 MVP 阶段不自动化；Human 通过 Markdown / PR diff 手动审查和修改。
- OpenSpec `affects_domain` 在 MVP 阶段优先使用 front matter 约定，正文可补充解释。
- reviewer identity 在 MVP 阶段使用字符串，后续再考虑 Git author、CODEOWNERS 或外部身份。
- examples 先把 ERP Order Cancellation 做成完整 demo，再补 CRM / IAM / Finance `Account` 歧义示例。
- Candidate 超过 30 天无人处理时进入 stale warning，不自动 rejected。

## 14. 未决问题

这些问题需要人类维护者后续确认：

- `affects_domain` 是否需要独立 JSON Schema 或 OpenSpec plugin 校验？
- Candidate stale warning 是放入 `opendomain validate`，还是放入 `opendomain doctor`？
- Candidate 接受后是否保留原 Candidate 文件，还是移动到 archived / superseded 状态？
- OpenDomain ID 命名是否允许跨组织 namespace，例如 `acme.sales.order`？
- Domain owner / reviewer 是否需要 CODEOWNERS 集成？
- Agent 如何从代码路径反查可能相关的 bounded context？

## 15. 第一阶段开发切片

建议第一轮开发只做 Phase 1 和 Phase 2 的最小垂直切片，但必须围绕 Order Cancellation grounding demo，而不是孤立实现 parser。

1. 固化 schema 结构。
2. 补齐 ERP Order Cancellation OpenDomain 示例。
3. 增加 OpenSpec `affects_domain` 示例。
4. 增加 parser。
5. 增加 validator。
6. 增加 `opendomain validate`。
7. 用 ERP demo 和 invalid fixtures 驱动测试。
8. 让 Agent 输出“本次避免的业务语义错误”。

这条切片能最快证明 OpenDomain 不是普通文档，而是可验证、可审查、能帮助 Agent 避免业务语义错误的 domain semantic layer。
