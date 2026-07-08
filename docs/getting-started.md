# OpenDomain 快速上手

本文面向第一次在自己仓库中引入 OpenDomain 的维护者。

目标是在 10 分钟内完成三件事：

1. 初始化 `domain/` 目录。
2. 验证生成的 OpenDomain 文件。
3. 明确第一条真实业务知识应该如何进入模型。

## 1. 安装 CLI

```bash
npm install -g @echopath-labs/opendomain
opendomain help
```

如果你在 OpenDomain 源码仓库中开发，可以用：

```bash
npm run opendomain -- help
```

## 2. 在项目中初始化

进入你的项目仓库：

```bash
cd your-project
opendomain init
```

`opendomain init` 会创建：

```text
domain/
  README.md
  contexts/
    example.md
  concepts/
    example.concept.md
  rules/
  lifecycles/
  events/
  candidates/
    candidate-0001-first-domain-model.md
AGENTS.md
```

它不会覆盖已有文件。已有文件会被报告为 `skipped`。

## 3. 验证生成结果

```bash
opendomain validate domain
```

通过验证只说明文件格式和引用关系成立，不代表这些 starter 内容已经是你的真实业务知识。

默认生成的 context、concept 和 candidate 都是 `proposed` 状态。你应该把它们替换成自己项目里的真实业务语义，并在确认后补充 evidence 和 human review 信息。

## 4. 查看 ERP 示例

如果你想先看一个完整示例：

```bash
opendomain init --example erp
opendomain validate examples/erp
```

ERP 示例展示了：

- accepted bounded context；
- accepted domain concept；
- accepted business rule；
- accepted lifecycle；
- accepted domain event；
- proposed Domain Candidate；
- OpenSpec `affects_domain` 如何引用 OpenDomain ID。

## 5. 写第一条真实 Domain Concept

选择一个在当前 Feature 结束后仍会长期成立的业务概念。

适合写进 OpenDomain：

- Customer 在 Sales context 中是什么意思；
- Order 有哪些长期生命周期状态；
- Confirmed Order 是否允许直接删除；
- Invoice 在财务语境里的业务含义。

不适合直接写进 OpenDomain：

- 这次 Feature 为什么要做；
- 某个任务的验收步骤；
- 某次技术方案取舍；
- Agent 本轮工作记录；
- 只从代码或数据库里猜出来、还没人确认的业务知识。

如果你不确定，就先写入 `domain/candidates/`。

## 6. 让 Codex 先读业务模型

Feature spec 可以用 `affects_domain` 引用 OpenDomain ID：

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
---
```

实现前运行：

```bash
opendomain prepare <feature-spec-or-dir>
```

Codex 应先读取输出中 `Read first` 列出的 accepted source files，并把 `Candidate boundaries` 视为 proposed knowledge。

## 7. 基本原则

- OpenDomain 记录长期业务语义。
- OpenSpec 记录本次变更的动机、需求、任务和验收。
- AI 推断出的知识先进 Candidate。
- Accepted knowledge 必须有人类 review 和 evidence。
- Index、graph、embedding 都只能是派生视图，不是 source of truth。
