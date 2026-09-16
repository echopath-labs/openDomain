# OpenDomain

[![CI](https://github.com/echopath-labs/openDomain/actions/workflows/ci.yml/badge.svg)](https://github.com/echopath-labs/openDomain/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/%40echopath-labs%2Fopendomain?label=npm)](https://www.npmjs.com/package/@echopath-labs/opendomain)
![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-green.svg)
![Status](https://img.shields.io/badge/status-stable-16a34a.svg)
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

> 从我指定的项目资料中整理业务规则，以及理解规则所需的概念、关系和状态。
> 推断出的业务知识先写成 Candidate 等我审查。

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

使用 OpenSpec、Spec Kit 或其他工具的 Agent 可以提供引用 accepted domain ID 的
OpenDomain 请求。OpenDomain 定义自己的契约，不规定其他工具的文档格式或工作流。
ADR 和工程计划仍是外部资料，不属于 OpenDomain 管理的业务知识。

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

OpenSpec 等规划工具只是可选场景。需要任务级 grounding 时，Agent 可直接提供 OpenDomain 原生 JSON/YAML 请求，运行 `opendomain assure --request <file>`。参见[声明契约与示例](USAGE.zh-CN.md)。

## 手动安装

大多数用户只需要让 Codex 安装。也可以手动使用相同渠道。

### npm stable 渠道

已有 Node.js 20，或 Node.js 22 及以上环境时使用 npm：

```bash
npm install --global @echopath-labs/opendomain
opendomain --version
opendomain init --tools codex
opendomain doctor
opendomain validate
```

需要固定版本时使用 `@echopath-labs/opendomain@0.1.1`。后续 prerelease 必须显式
选择，并且不能替代稳定的 npm `latest` 渠道。

### 从 0.1.0 升级

`0.1.1` 修复缺少 grounding 声明时的诊断问题（#22），并提供原生 `--request` 入口。
升级 CLI 后，在每个已有工作区刷新受管指令：

```bash
npm install --global @echopath-labs/opendomain@0.1.1
opendomain --version
opendomain update --json
opendomain doctor --json
opendomain validate --json
```

业务模型无需迁移。旧 OpenSpec/Profile 输入仍可使用；新请求可遵循
[原生声明契约](USAGE.zh-CN.md)。更新会刷新 OpenDomain 受管指令并保留用户内容。
完整变化见 [0.1.1 变更日志](CHANGELOG.md)。

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

当前稳定版 `0.1.1` 包含：

- Markdown + YAML front matter source of truth；
- Schema 校验与引用完整性检查；
- accepted 概念、规则、生命周期、事件与证据；
- Candidate-first AI 推断和显式人工审查；
- 确定性 Semantic Closure 与派生 read-first index；
- 可选的多产品 workspace 治理、exposure 传播与 public dependency closure 校验；
- 无进程副作用的 Embeddable Core v1、source-first query 与版本化 context export；
- Grounding Request、Grounding Pack 和 advisory/enforced Assurance；
- 不依赖规划工具的原生 JSON/YAML grounding 请求；
- 可选的旧 OpenSpec grounding 与声明式 Integration Profile 兼容入口；
- 受管 Codex 指令、Skills、更新和诊断；
- 不引入宿主 package metadata 的 npm 与独立 CLI 分发。

OpenDomain `0.1.1` 保持 `0.1.0` 已建立的稳定兼容面：公开 Markdown/YAML source schemas、
Grounding Protocol v1、Core API 1.0、context-export v1、文档化 CLI 行为与退出语义、
workspace resolution，以及 package-neutral npm/standalone 安装。Candidate approval
与 Promotion 是两次独立人工审查，任何一步都不能静默创建 accepted knowledge。
独立外部客户验证仍是明确延期项。

多产品 canonical workspace 可以增加版本化的 `opendomain/governance.yaml`，并把每个
domain group 的普通语义目录放入声明的 `source_root`。`opendomain validate --json`
会返回 product/group owner、依赖图、exposure 诊断与派生 public closure。closure 通过
只是静态证据，不会发布文件、授予权限、修改 Git，也不要求安装 EchoPath。详见
[多产品 Workspace 治理](USAGE.zh-CN.md#多产品-workspace-治理)。

Host 或插件作者可以从 package root 或 `@echopath-labs/opendomain/core` 导入与 CLI
完全相同的 validate、query 和 context-export 实现。`opendomain export context` 只把
accepted content 放进 documents，并单独标记 Candidate；
`--exposure public --product <id>` 只有在当前 public dependency closure 可证明时才会
成功。该 API 只读，不管理 EchoPath memory、不接受 Candidate、不写公开投影，也不执行
release。详见[嵌入 Core 与导出 Context](USAGE.zh-CN.md#嵌入-core-与导出-context)。

package root 与 `./core` 是受支持的 JavaScript API。导出的 `schemas/*` 路径属于公开
数据契约，按 package 兼容策略演进；`src/*` 是内部模块，不再导出。随包提供的示例只
是说明性、非规范 fixture，不属于 JavaScript API，也不构成产品需求。

## 公开资料

- [简体中文使用指南](USAGE.zh-CN.md)
- [Agent 安装契约](INSTALL.md)
- [ERP 示例](examples/erp/README.md)
- [变更日志](CHANGELOG.md)
- [贡献指南](CONTRIBUTING.md)
- [安全策略](SECURITY.md)
- `schemas/`：公开的机器可读数据契约

维护者规划记录属于私有过程资料，不会进入公开仓库或 npm 包。
`examples/erp/` 下的 OpenSpec 只是合成互操作 fixture。

OpenDomain 从 `0.1.0-rc.1` 开始采用 [Apache License 2.0](LICENSE)。已经发布的
`0.1.0-alpha.10` 及更早 artifacts 保持其原始许可身份；归属信息见 [NOTICE](NOTICE)。
