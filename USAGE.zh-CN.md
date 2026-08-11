# OpenDomain 使用指南

> English: [USAGE.md](USAGE.md) | 项目简介: [README.zh-CN.md](README.zh-CN.md) |
> Agent 安装契约: [INSTALL.md](INSTALL.md)

本指南面向希望把 OpenDomain 嵌入日常 Codex 工作流的团队。你表达目标，Codex 在
明确边界内选择并执行 OpenDomain 工作流，并提供可审查的证据。

## 开始之前

OpenDomain 保存长期业务语义，不是软件仓库里的所有事实。先选择一个真实 bounded
context，以及少量会实际约束实现的概念、规则或生命周期。

责任边界必须始终明确：

- 你负责目标、业务边界、风险取舍、Candidate 决定和最终验收；
- Codex 负责检查环境、选择路径、执行工具、区分证据状态、验证和报告；
- 仓库规则和工具审批继续生效；
- 推断语义先进入 Candidate，不能被当作 accepted truth。

## 让 Codex 安装 OpenDomain

在仓库根目录直接说：

> 帮我在当前工作区安装 OpenDomain。遵循官方 Agent 安装契约，初始化 Codex
> 集成并证明它已经可用，不要给这个项目添加 package metadata。

Codex 应该：

1. 检查仓库指令和目标 workspace root；
2. 复用 `PATH` 上健康的 `opendomain` CLI，或选择兼容渠道安装；
3. 为新集成执行初始化，为已有受管集成执行更新；
4. 运行诊断和仓库验证；
5. 报告 CLI 版本、安装路径、变更文件和检查结果；
6. 确认宿主 `package.json` 与 lockfile 没有被创建或修改。

可观察的命令序列是：

```bash
opendomain --version
opendomain init --tools codex --json
opendomain doctor --json
opendomain validate --json
```

对于已经配置好的集成，Codex 使用：

```bash
opendomain update --json
opendomain doctor --json
opendomain validate --json
```

初始化生成的 Skills 可能无法被当前 Codex 任务热加载。负责安装的 Agent 仍必须直接
完成本轮安装、诊断和验证；后续任务会自动发现受管仓库区块和生成的 Skills。

## 安装渠道

[Agent 安装契约](INSTALL.md)是渠道选择和安全边界的正式依据。

### npm alpha

已经有 Node.js 20，或 Node.js 22 及以上环境时优先使用 npm：

```bash
npm install --global @echopath-labs/opendomain@alpha
opendomain --version
```

这是全局工具安装，不要把 OpenDomain 加进宿主项目依赖或 scripts，也不要默认使用
`sudo npm install`。

### 已校验的独立二进制

没有兼容 npm 环境时使用独立二进制。从 [GitHub Releases](https://github.com/echopath-labs/openDomain/releases)
下载同一版本的 executable 和 `SHA256SUMS.txt`。

| Target | 最低系统 |
| --- | --- |
| `darwin-arm64` / `darwin-x64` | macOS 13.5 |
| `linux-x64` | kernel 4.18、glibc 2.28、`GLIBCXX_3.4.25` |
| `windows-x64.exe` | Windows 10 或 Windows Server 2016 |

macOS 使用 `shasum -a 256`，Linux 使用 `sha256sum`，PowerShell 使用
`Get-FileHash -Algorithm SHA256`。只安装到 `PATH` 上用户拥有的目录。当前 macOS
二进制采用 ad-hoc 签名但未 notarize，Windows 二进制没有 Authenticode 签名。

npm 使用显式 alpha tag 升级；独立二进制需要下载、校验并替换 executable。升级后
运行：

```bash
opendomain update --json
opendomain doctor --json
opendomain validate --json
```

## 初始化会改变什么

Canonical workspace 是 `opendomain/`。在 `0.x` 期间，只有 canonical root 不存在
时才会带警告读取 legacy `domain/`。如果两个目录都存在，`opendomain/` 生效，
OpenDomain 永远不会合并两棵目录。

Codex 初始化会管理：

- `opendomain/config.yaml` 和初始语义目录；
- `AGENTS.md` 中一个带 marker 的 OpenDomain 区块；
- `.codex/skills/opendomain-explore/SKILL.md`；
- `.codex/skills/opendomain-model/SKILL.md`；
- `.codex/skills/opendomain-review/SKILL.md`。

受管区块外的既有内容仍由用户拥有。遇到同名用户 Skill 时，OpenDomain 会报告冲突，
不会覆盖。

## 多产品 Workspace 治理

现有单产品布局仍是默认行为。当一个物理 `opendomain/` 根需要容纳多个独立 owner 的
产品时，增加 `opendomain/governance.yaml`：

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

每个 `source_root` 继续使用普通的 `contexts/`、`concepts/`、`rules/`、
`lifecycles/`、`events/` 与 `candidates/`。所有 root 必须是 `opendomain/`
内部互不重叠的真实目录；每个受治理语义 source 必须且只能属于一个 domain group。

exposure 从最公开到最严格固定为：

```text
public < ecosystem < internal < private
```

节点只能依赖相同或更公开的目标。跨产品 group 依赖还必须声明对应 product 依赖。
`forbidden_dependencies` 会传递检查并返回完整依赖路径。

面向人或自动化执行：

```bash
opendomain validate
opendomain validate --json
```

JSON 会增加 `governance.dependency_graph` 和
`governance.publication_closures`，包含 manifest provenance、纳入的节点/文件与
selection path。未知 schema version/exposure、循环、缺失 target、root 重叠、未归属
source、forbidden path 与 private-to-public 泄漏都会 fail closed。

publication closure 是可重建的静态证据。它不会发布仓库、复制公开投影、授予权限、
修改 Git 或证明 release 已发生。npm 包与独立 executable 使用相同规则，不依赖
EchoPath、AGW、package-manager workspace 或私有 sibling。没有 `governance.yaml` 时，
现有 canonical、legacy 与 explicit-target 行为保持不变。

## 嵌入 Core 与导出 Context

正常用户仍然可以直接向 Codex 表达意图。以下接口面向需要可观察 context payload 的
Agent host、插件、CI 和维护者。

直接查询当前 source，不创建或读取 generated index：

```bash
opendomain query --id sales.order --json
opendomain query --context sales --type domain_concept --json
```

导出选中的 accepted sources、semantic closure、evidence、review、source hash 和相关但
非权威的 Candidate boundaries：

```bash
opendomain export context --id sales.order --json
```

selector 包括 `--id`、`--context`、`--product`、`--domain-group`、`--owner`、
`--lifecycle` 和 `--type`。多个 selector 使用逻辑 AND。请求至少要有一个 selector；
空请求或无匹配请求会失败，不会回退成整个 workspace 导出。

在受治理的 canonical workspace 中，可以导出一个完整 public proof：

```bash
opendomain export context --product public_api --exposure public --json
```

public export 必须使用当前验证通过的 publication closure。ungoverned workspace、非 public
product、非法依赖图、无法映射的 source 或会裁剪 proof 的额外 selector 都会 fail closed。
通过的 payload 也只是证据，不会复制文件、修改 Git、授予权限或发布任何内容。

Node host 和插件作者可以有意把 npm 包作为依赖，并使用无副作用 Core API：

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

package root 与 `@echopath-labs/opendomain/core` 暴露相同的 Core API `1.0`。调用只返回
结构化结果，不写 stdout/stderr、不设置 process exit code、不创建 index、不修改 source、
不访问 Git/network，也不管理 EchoPath lifecycle。`opendomain.context-export.v1` 包含完整
accepted Markdown content 和 workspace-relative provenance；Candidate 只会出现在
`candidate_boundaries`，并明确标记 `authoritative: false`。

Core v1 内可以增加 named export 和可选结果字段。删除字段、改变 selector AND 语义、削弱
Candidate 隔离或重新解释 exposure proof，都必须使用新的 API/export version 并提供迁移说明。
普通项目仍应遵循 Agent 安装契约，不能只是为了使用 CLI 就给宿主项目增加依赖。

## 第一次只读了解业务

可以说：

> 只读了解订单取消相关的 accepted 业务模型，不要修改任何内容。列出相关概念、
> 规则、生命周期、证据、Candidate boundaries 和模型缺口。

Codex 应先验证 workspace，找到最小的相关 accepted source 集合，读取证据，并把
Candidate 分开报告。结果至少应该包含：

- 读取过的 accepted IDs 与 source files；
- 会影响当前问题的长期规则或生命周期约束；
- Candidate IDs 及当前 review state；
- 缺失、冲突或陈旧知识；
- 没有修改领域文件的确认。

## 既有项目逆向建模

既有项目不需要先完成完整模型才能使用 OpenDomain。先执行只读证据调查：

> 检查这个既有项目的产品文档、实际行为、测试、代码、API 和 Schema，暂时不要
> 修改。提出最小可用 bounded context，并区分哪些结论是直接证据、哪些是推断。

由人确认调查边界和初始 accepted scope 后再说：

> 为已经确认的 bounded context 建立第一版 OpenDomain 模型。稳定且有证据的语义
> 写入适当模型，所有不确定、推断或冲突判断先写成 Candidate 等待人工审查。

代码、API、数据库 Schema 和测试只是证据，不会自动成为 accepted domain meaning。
先选择一个真正影响实现的工作流，不要一次逆向整个系统。

后续 Assurance 如果报告 `domain_model_gap`，Codex 应说明缺少哪些必要语义，并提出
有证据的 Candidate 工作。这代表采用尚不完整；格式错误、断裂 ID、accepted 与
Candidate 边界冲突则属于完整性失败，仍然必须阻断。

## 审查 Candidate

可以说：

> 审查 candidate-0001，列出 target、evidence、confidence、可能冲突和兼容性影响。
> 在我明确选择之前，不要记录决定。

Codex 应读取 Candidate 和它可能影响的 accepted source。然后由人明确选择
`accepted`、`rejected`、`superseded` 或 `deprecated`，并提供 reviewer 和 reason。

只有在获得决定后，Codex 才可以执行类似变更：

```bash
opendomain candidate review candidate-0001 --decision rejected --reviewed-by chase --reason "Conflicts with confirmed order policy"
opendomain validate
```

`accepted` Candidate review 只会记录需要 promotion，不会静默改写 accepted
knowledge。Promotion 仍是一次单独审查的领域模型变更。

## 为实现任务准备 Grounding

可以说：

> 实现这个变更。修改行为前先判断是否涉及长期领域语义，对适用 Source Unit 运行
> OpenDomain Assurance，读取列出的全部 accepted sources，并单独报告 Candidate
> boundaries。

对于 OpenSpec Source Unit，Codex 通常执行：

```bash
opendomain assure --integration openspec <source-unit>
```

Assurance 会分开报告 Grounding Request、准备状态和策略结果：

| Grounding 状态 | 含义 |
| --- | --- |
| `required` | 本次工作受 accepted domain semantics 约束 |
| `not_required` | 明确不需要 grounding，并提供了 rationale |
| `unclassified` | 当前证据不足以判断 |

| Preparation | Advisory | Enforced |
| --- | --- | --- |
| `prepared` 或合法 `not_required` | pass | pass |
| `domain_model_gap` 或 `unclassified` | warn | fail |
| 非法输入、矛盾或断裂引用 | fail | fail |

完成报告应包含 accepted IDs 与 source paths、Candidate boundaries、Assurance mode
和 outcome，以及未解决 model gap。Assurance 评估的是当前声明和证据，不能证明
Agent 已经理解模型。

## 与 OpenSpec、Spec Kit 或其他规划来源配合

OpenDomain 不绑定某个规划工具：

```text
planning source
  -> built-in adapter 或声明式 Integration Profile
  -> Grounding Request
  -> OpenDomain prepare / assure
  -> Grounding Pack
  -> Codex 读取 accepted evidence 与 Candidate boundaries
```

OpenSpec 可以直接声明 `grounding` 和 `affects_domain`。规划来源继续拥有变更意图和
验收标准；OpenDomain 拥有被引用的长期语义。

其他结构化格式可以在 `opendomain/integrations/profiles/` 下定义 repository-local
Profile，然后检查：

```bash
opendomain integrations validate
opendomain integrations list
opendomain prepare --profile <profile-id> <source-unit>
opendomain assure --profile <profile-id> <source-unit>
```

Profile 只归一化已声明的结构化字段，不扫描正文、不执行扩展、不推断 ID、不创建
Candidate，也不提升 knowledge。Profile v1 会把 grounding 归一化为
`unclassified`；除非 source integration 能提供显式 decision，否则使用 advisory
Assurance。

## 诊断与恢复

| 现象 | 处理方式 |
| --- | --- |
| 找不到 `opendomain` | 让 Codex 按安装契约安装，并报告选定的用户安装路径 |
| `doctor` 报告受管文件缺失或陈旧 | 检查 ownership conflict 后运行 `update`，不要覆盖用户 Skill |
| `opendomain/` 与 `domain/` 同时存在 | 使用 canonical `opendomain/` 并有计划迁移，因为两棵目录不会合并 |
| Assurance 报告 `domain_model_gap` | 审查缺失语义，逐步创建有证据的 Candidate |
| Enforced Assurance 拒绝 `unclassified` | 用证据完成分类，或在建模期间保持 advisory |
| Profile 匹配不唯一 | 显式选择一个 Profile，或缩小 match declaration |
| Candidate 已陈旧 | 审查、增加证据、拒绝、supersede 或 deprecate；不能把时间当作接受 |

修复后运行：

```bash
opendomain doctor --json
opendomain validate --json
```

## CLI 附录

直接命令适合 CI、诊断和维护者。正常用户可以继续向 Codex 表达意图。

| 目标 | 命令 |
| --- | --- |
| 初始化 Codex 集成 | `opendomain init --tools codex` |
| 同步受管资源 | `opendomain update` |
| 诊断集成 | `opendomain doctor` |
| 验证当前 workspace | `opendomain validate` |
| 列出 accepted IDs | `opendomain ids list` |
| 检查引用 | `opendomain refs check` |
| 列出 Candidate | `opendomain candidate list` |
| 查看 Candidate | `opendomain candidate show <candidate-id>` |
| 准备 Grounding Pack | `opendomain prepare <source-unit>` |
| 执行 advisory Assurance | `opendomain assure <source-unit>` |
| 执行 enforced Assurance | `opendomain assure --mode enforced <source-unit> --json` |
| 查看 Profile | `opendomain integrations list` |
| 验证 Profile | `opendomain integrations validate` |
| 构建派生 index | `opendomain index build` |
| 查询 domain ID | `opendomain index query <domain-id>` |
| 查询当前 source | `opendomain query --id <domain-id>` |
| 导出 accepted context | `opendomain export context --id <domain-id> --json` |
| 导出 public closure | `opendomain export context --product <product-id> --exposure public --json` |

## ERP 示例

[ERP 示例](examples/erp/README.md)展示一个 accepted order 模型、一个 Candidate、
OpenSpec grounding 和一个通用 structured-source Profile。它是合成学习材料，不是
完整 ERP ontology。

公开项目入口：[README](README.zh-CN.md)、[贡献指南](CONTRIBUTING.md)、
[安全策略](SECURITY.md)和[变更日志](CHANGELOG.md)。
