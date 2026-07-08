# OpenDomain

一个面向 AI Agent 和人类维护者的 Git 原生、证据驱动领域语义层。

[![CI](https://github.com/echopath-labs/openDomain/actions/workflows/ci.yml/badge.svg)](https://github.com/echopath-labs/openDomain/actions/workflows/ci.yml)
![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)
![Status](https://img.shields.io/badge/status-alpha-f59e0b.svg)
![Node](https://img.shields.io/badge/node-%3E%3D20-0f766e.svg)
![Source](https://img.shields.io/badge/source-Markdown%20%2B%20YAML-2563eb.svg)

> English version: [README.md](README.md)

OpenDomain 用来在软件仓库中持续沉淀长期业务知识：一个业务概念是什么、不是什么，哪些规则长期成立，对象有哪些生命周期，哪些证据支持这些知识，以及哪些内容需要人类审查后才能成为可信语义。

它的核心目标是让 Codex、Claude Code、Cursor、Gemini CLI 等 AI 编码 Agent 在修改系统前，能够稳定读取业务语义，而不是临时从代码、数据库、接口或聊天上下文里猜业务含义。

OpenDomain 当前是 early alpha。格式和 CLI 仍可能演进，但已经具备第一批 MVP 能力。

## 为什么需要它

AI 编码 Agent 很容易从实现细节里推断业务语义，但实现结构不等于业务世界。

没有稳定的领域语义层时，团队会反复遇到这些问题：

- Agent 把数据库表、API shape 或代码结构误认为业务模型；
- 长期业务规则散落在代码、测试、文档和历史 Spec 里；
- 同一个概念在不同上下文中被混用；
- 某次 Feature 的设计选择被误当成永久规则；
- AI 推断出的“知识”缺少证据、状态和人类审查；
- 一年后很难重新找到相关业务模型、规则和历史变更。

OpenDomain 提供一种轻量方式，把这些长期语义放回 Git，并让 Agent 能通过结构化入口读取。

## OpenDomain 是什么

OpenDomain 是：

- Git-native：source of truth 是仓库中的 Markdown 文件；
- evidence-backed：重要语义必须有证据；
- AI-maintainable：结构化到足够让 Agent 解析、检索和引用；
- human-reviewable：普通 Git diff 就能审查；
- domain-focused：记录长期业务语义，而不是一次性任务说明。

它回答的是：

```text
业务世界是什么？
哪些概念长期存在？
它们属于哪个业务上下文？
哪些规则、不变量和生命周期必须长期成立？
哪些知识已经被人类确认？
哪些只是待审 Candidate？
```

## 与 OpenSpec / EchoPath 的边界

OpenDomain、OpenSpec 和 EchoPath 是三个不同层次：

```text
OpenDomain
  长期业务语义
  说明业务世界是什么，哪些规则长期成立

OpenSpec
  变更意图与交付规范
  说明这次为什么改、要交付什么、如何验收

EchoPath
  Agent 执行连续性
  说明 Agent 如何恢复、交接、保留执行上下文
```

判断一条知识放在哪里，可以先用这条规则：

```text
如果一条知识在当前 Feature 结束后仍长期成立，它更可能属于 OpenDomain。
如果一条知识只解释某次变更的动机、设计、任务或验收，它属于 OpenSpec。
```

OpenSpec 应该引用 OpenDomain ID，而不是复制 OpenDomain 定义。

## 适合谁使用

OpenDomain 适合：

- 使用 AI Agent 长期维护复杂业务系统的团队；
- 希望把业务概念、规则、生命周期和证据放进 Git 的维护者；
- 需要让 Agent 在改代码前先读取业务语义的项目；
- 需要区分 accepted knowledge 和 AI-inferred Candidate 的团队；
- 正在使用 OpenSpec，并希望 Feature spec 能引用长期业务模型的项目。

它特别适合 ERP、CRM、WMS、MES、财务、供应链、订单、库存、制造、支付、权限等业务规则密集的系统。

## 这个项目现在能做什么

当前 MVP 已包含：

- Markdown + YAML front matter 领域语义文件；
- Bounded Context、Domain Concept、Business Rule、Lifecycle、Domain Event、Domain Candidate；
- parser 和 validator；
- CLI 命令：init、validate、ids list、refs check、prepare、index、demo；
- OpenSpec `affects_domain` grounding；
- Candidate 边界检查；
- Semantic Retrieval Index，作为派生的 read-first 检索视图；
- ERP Order Cancellation 示例；
- OpenDomain 自己的 self-model dogfooding。

## 非目标

OpenDomain 当前不做：

- OpenSpec 的领域版复制品；
- 数据库 schema 文档；
- 长篇业务百科；
- 未经审查的 AI memory；
- 自动接受 AI 推断的知识库；
- 以图数据库、embedding index 或 MCP resource 作为 source of truth；
- SaaS 协作平台；
- OWL / RDF / SPARQL 默认建模入口。

这些能力未来可以作为导出、派生视图或生态集成出现，但 MVP 的 source of truth 仍然是 Git 中的 Markdown 文件。

## 30 秒开始

OpenDomain 的 npm 包名是 `@echopath-labs/opendomain`，CLI 命令是 `opendomain`。

全局安装 CLI：

```bash
npm install -g @echopath-labs/opendomain
opendomain init
opendomain validate domain
```

也可以从源码运行。

克隆仓库：

```bash
git clone https://github.com/echopath-labs/openDomain.git
cd openDomain
```

查看 CLI：

```bash
npm run opendomain -- help
```

初始化 OpenDomain 目录：

```bash
npm run opendomain -- init
```

运行测试：

```bash
npm test
```

验证 OpenDomain 文件：

```bash
npm run opendomain -- validate
```

运行 ERP 示例验证：

```bash
npm run opendomain -- validate examples/erp
```

为一个 Feature 准备 Codex grounding：

```bash
npm run opendomain -- prepare examples/erp/openspec/changes/order-cancellation/spec.md
```

构建并查询 Semantic Retrieval Index：

```bash
npm run opendomain -- index build examples/erp --out /tmp/erp-index.json
npm run opendomain -- index query sales.order --index /tmp/erp-index.json
```

## 核心工作流

### 1. 写长期业务语义

把长期成立的业务知识写入 `domain/` 或 `examples/<name>/domain/`：

```text
domain/
  contexts/
  concepts/
  rules/
  lifecycles/
  events/
  candidates/
```

例如 `sales.order` 应该说明 Order 在 Sales context 中是什么意思，它不是什么，它受哪些规则和生命周期约束，以及证据是什么。

### 2. 用 OpenSpec 引用 OpenDomain

Feature spec 通过 `affects_domain` 引用 OpenDomain ID：

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

OpenSpec 描述这次变更，OpenDomain 描述长期语义。

### 3. Codex 先 grounding 再实现

在实现非平凡 Feature 前，Codex 应运行：

```bash
npm run opendomain -- prepare <feature-spec-or-dir>
```

输出会告诉 Codex：

- `Read first`：先读哪些 accepted source files；
- `Candidate boundaries`：哪些内容只是 proposed，不能当真；
- `Avoided semantic errors`：实现时要避免哪些业务语义错误。

### 4. 不确定知识先写 Candidate

AI 从代码、API、DB、测试或历史 Spec 里发现的新领域知识，默认写成 Domain Candidate：

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

Candidate 不是 accepted truth。它只是待人类审查的提案。

## 常用命令

| 目标 | 命令 |
| --- | --- |
| 查看帮助 | `npm run opendomain -- help` |
| 初始化 OpenDomain 目录 | `npm run opendomain -- init` |
| 复制 ERP 示例 | `npm run opendomain -- init --example erp` |
| 验证全部 OpenDomain 文件 | `npm run opendomain -- validate` |
| 验证指定目录 | `npm run opendomain -- validate examples/erp` |
| 输出 JSON 验证结果 | `npm run opendomain -- validate examples/erp --json` |
| 为 Feature 准备 grounding | `npm run opendomain -- prepare <feature-spec-or-dir>` |
| 显式使用 OpenSpec integration | `npm run opendomain -- prepare --integration openspec <feature-spec-or-dir>` |
| 列出 ID | `npm run opendomain -- ids list examples/erp` |
| 检查引用 | `npm run opendomain -- refs check examples/erp` |
| 构建 index | `npm run opendomain -- index build examples/erp --out /tmp/erp-index.json` |
| 查询 ID | `npm run opendomain -- index query sales.order --index /tmp/erp-index.json` |
| 查询 context | `npm run opendomain -- index query --context sales --index /tmp/erp-index.json` |
| 运行 demo | `npm run demo` |
| 运行测试 | `npm test` |
| 验证 OpenSpec | `npm run openspec:validate` |

## 文档

- [快速上手](docs/getting-started.md)
- [使用说明](docs/usage.md)
- [产品愿景](docs/vision.md)
- [MVP PRD](docs/product-prd.md)
- [架构说明](docs/architecture.md)
- [Candidate 工作流](docs/candidate-workflow.md)
- [Semantic Retrieval Index](docs/semantic-retrieval-index.md)
- [MVP Grounding Demo](docs/mvp-grounding-demo.md)
- [OpenDomain self-model dogfooding](docs/dogfooding-self-model.md)
- [开发指南](docs/OPEN_DOMAIN_DEVELOPMENT_GUIDE.md)
- [路线图](ROADMAP.md)
- [变更日志](CHANGELOG.md)

## 当前状态

OpenDomain 目前是 early alpha。

已经可以用于：

- 学习和试用 Git-native domain semantics；
- 初始化一个项目的 OpenDomain 目录；
- 运行 ERP 示例；
- 验证 OpenDomain 文件格式；
- 为 OpenSpec Feature 生成 grounding pack；
- 用 index 生成 read-first plan；
- 在本仓库中 dogfood OpenDomain 自身模型。

暂时不建议直接用于生产治理的唯一来源。更合理的使用方式是先在一个业务子域中试点，让人类 reviewer 审查 accepted knowledge 和 Candidate 流程是否符合团队习惯。

## 开源边界

这个仓库只包含通用领域语义层、工具链、示例和 OpenDomain 自身模型。

请不要提交：

- 公司内部流程；
- 客户名称；
- 生产凭证；
- 私有业务规则；
- 未脱敏的数据库结构；
- 内部项目记忆；
- 未经授权的业务文档或代码片段。

如果你要在公司内部使用 OpenDomain，建议在私有仓库维护项目自己的 `domain/` 文件。

## 贡献

见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 安全

见 [SECURITY.md](SECURITY.md)。

## 开源协议

本项目采用 MIT 协议，见 [LICENSE](LICENSE)。
