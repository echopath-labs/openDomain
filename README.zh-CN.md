# OpenDomain

[![CI](https://github.com/echopath-labs/openDomain/actions/workflows/ci.yml/badge.svg)](https://github.com/echopath-labs/openDomain/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/%40echopath-labs%2Fopendomain/alpha?label=npm)](https://www.npmjs.com/package/@echopath-labs/opendomain)
![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)
![Status](https://img.shields.io/badge/status-alpha-f59e0b.svg)
![Node](https://img.shields.io/badge/node-%3E%3D20-0f766e.svg)
![Source](https://img.shields.io/badge/source-Markdown%20%2B%20YAML-2563eb.svg)

> English: [README.md](README.md)

OpenDomain 是面向 AI Agent 与人类维护者的 Git 原生、证据驱动领域语义层。它用
仓库内可读的 Markdown 长期保存业务概念、规则、生命周期、事件、证据和审查状态。

## 从 Codex 开始

在需要建模的项目中打开一个可执行 Shell 的 Codex 任务，然后直接说：

> 帮我在当前工作区安装 OpenDomain。遵循官方 Agent 安装契约，初始化 Codex
> 集成并证明它已经可用，不要给这个项目添加 package metadata。

Codex 应按照 [Agent 安装契约](INSTALL.md)选择兼容的安装渠道，执行初始化或更新，
最后通过 `doctor` 和 `validate` 验证工作区。

安装后继续用自然语言工作：

> 只读了解订单取消相关的 accepted 业务模型，不要修改任何内容，并把 Candidate
> 与 accepted knowledge 分开。

> 根据这个既有项目的代码和产品文档逆向梳理业务模型，所有不确定的业务判断先写成
> Candidate 等我审查。

> 审查 candidate-0001，列出证据、冲突和兼容性影响，然后等我决定。

> 实现这个变更，修改行为前先完成 OpenDomain grounding，最后报告使用过的
> accepted IDs 和 Candidate boundaries。

受管仓库指令和 Codex Skills 会把这些意图路由到 OpenDomain。正常工作流不需要用户
自己选择 CLI 命令。完整过程和恢复方式见[简体中文使用指南](USAGE.zh-CN.md)。

## 人与 Agent 的责任

OpenDomain 采用有边界的 Agent 自主性：

| 人负责 | Codex 负责 |
| --- | --- |
| 目标与期望结果 | 阅读仓库指令和运行环境 |
| 业务边界与最终语义 | 选择合适的 OpenDomain 工作流 |
| 风险取舍和 Candidate 决定 | 执行工具并维持证据边界 |
| 最终验收 | 报告验证结果和未解决缺口 |

AI 推断出的知识不会自动变成 accepted domain knowledge。它必须先进入 Domain
Candidate，并由人明确作出审查决定。Codex 也不能绕过 Shell、网络、文件系统、
仓库规则或审批边界。

## 产品边界

```text
OpenDomain
  长期业务语义
  说明业务世界是什么，哪些规则长期成立

OpenSpec / Spec Kit / 其他规划工具
  变更意图与交付规范
  说明这次为什么改、交付什么、如何验收

EchoPath
  Agent 执行连续性
  说明 Agent 工作如何恢复、交接和继续
```

OpenSpec 等规划来源可以声明受影响的 OpenDomain ID，但应该引用 accepted domain
knowledge，而不是复制其定义。

## 项目中会增加什么

`opendomain init --tools codex` 只创建或更新 OpenDomain 拥有的资源：

```text
opendomain/
  config.yaml
  contexts/
  concepts/
  rules/
  lifecycles/
  events/
  candidates/

AGENTS.md                              受管 OpenDomain 区块
.codex/skills/opendomain-explore/     生成的 Skill
.codex/skills/opendomain-model/       生成的 Skill
.codex/skills/opendomain-review/      生成的 Skill
```

命令会保留用户拥有的内容，不会创建或修改宿主项目的 `package.json`、lockfile、依赖
或 npm scripts。是否提交这些文件由项目自己决定；它们可以被正常 Git 版本管理。

## 手动安装

大多数用户只需要让 Codex 安装。也可以手动使用相同渠道。

### npm alpha 渠道

已有 Node.js 20，或 Node.js 22 及以上环境时使用 npm：

```bash
npm install --global @echopath-labs/opendomain@alpha
opendomain --version
opendomain init --tools codex
opendomain doctor
opendomain validate
```

预发布阶段必须显式使用 `@alpha`。

### 独立二进制

没有兼容 npm 环境时，从 [GitHub Releases](https://github.com/echopath-labs/openDomain/releases)
下载匹配的二进制和 `SHA256SUMS.txt`，执行前必须核对准确 checksum。

| Target | 最低系统 |
| --- | --- |
| `darwin-arm64` / `darwin-x64` | macOS 13.5 |
| `linux-x64` | kernel 4.18、glibc 2.28、`GLIBCXX_3.4.25` |
| `windows-x64.exe` | Windows 10 或 Windows Server 2016 |

首批 macOS 二进制采用 ad-hoc 签名但未 notarize；Windows 二进制没有 Authenticode
签名。Checksum 可以发现文件变化，但不能证明发布者身份。校验和升级步骤见
[安装渠道](USAGE.zh-CN.md#安装渠道)。

## 当前能力

当前 alpha 已包含：

- Markdown + YAML front matter source of truth；
- Schema 校验与引用完整性检查；
- accepted 概念、规则、生命周期、事件与证据；
- Candidate-first AI 推断和显式人工审查；
- 确定性 Semantic Closure 与派生 read-first index；
- 可选的多产品 workspace 治理、exposure 传播与 public dependency closure 校验；
- Grounding Request、Grounding Pack 和 advisory/enforced Assurance；
- 内置 OpenSpec grounding 与声明式 Integration Profile；
- 受管 Codex 指令、Skills、更新和诊断；
- 不引入宿主 package metadata 的 npm 与独立 CLI 分发。

OpenDomain 当前适合限定范围试点和公开迭代。稳定版之前格式与 CLI 仍可能变化，暂时
不应成为生产关键领域决策的唯一治理来源。

多产品 canonical workspace 可以增加版本化的 `opendomain/governance.yaml`，并把每个
domain group 的普通语义目录放入声明的 `source_root`。`opendomain validate --json`
会返回 product/group owner、依赖图、exposure 诊断与派生 public closure。closure 通过
只是静态证据，不会发布文件、授予权限、修改 Git，也不要求安装 EchoPath。详见
[多产品 Workspace 治理](USAGE.zh-CN.md#多产品-workspace-治理)。

## 公开资料

- [简体中文使用指南](USAGE.zh-CN.md)
- [Agent 安装契约](INSTALL.md)
- [ERP 示例](examples/erp/README.md)
- [变更日志](CHANGELOG.md)
- [贡献指南](CONTRIBUTING.md)
- [安全策略](SECURITY.md)
- `schemas/`：机器可读契约

维护者规划记录属于私有过程资料，不会进入公开仓库或 npm 包。
`examples/erp/` 下的 OpenSpec 只是合成互操作 fixture。

OpenDomain 使用 [MIT License](LICENSE)。
