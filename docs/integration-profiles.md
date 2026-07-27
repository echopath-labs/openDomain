# OpenDomain Integration Profile 使用指南

Integration Profile 让 OpenDomain 接收 OpenSpec 之外的结构化规划格式，同时保持
Grounding Protocol v1 和领域模型边界不变。

```text
OpenSpec / Spec Kit / 其他结构化规划来源
  -> built-in adapter 或 repository-local Integration Profile
  -> Grounding Request v1
  -> accepted OpenDomain semantic closure
  -> Grounding Pack
  -> Codex / 其他 Agent consumer
```

Profile Runtime 只做确定性的格式归一化。它不会从正文推断领域 ID，不会创建或
提升 Domain Candidate，也不会修改 accepted OpenDomain 文件。

## 1. 快速体验

ERP 示例包含一个 `structured-feature` Profile：

```bash
cd examples/erp

# 查看 built-in integration 和本地 Profile
opendomain integrations list

# 检查全部本地 Profile
opendomain integrations validate

# 显式选择 Profile
opendomain prepare \
  --profile structured-feature \
  external-features/order-cancellation.yaml

# 只有一个 adapter 匹配时也可以自动选择
opendomain prepare external-features/order-cancellation.yaml
```

从源码仓库运行时，把 `opendomain` 替换为
`node ../../bin/opendomain.mjs`。

## 2. Profile 放在哪里

每个项目把一份 Profile 写成一个 YAML 文件：

```text
opendomain/
  contexts/
  concepts/
  rules/
  lifecycles/
  events/
  candidates/
  integrations/
    profiles/
      structured-feature.yaml
```

Profile 属于版本化的工作区配置，不属于 accepted semantic corpus。
`opendomain validate` 不会把它当成 Domain Concept、Rule 或 Candidate；
使用以下命令单独检查：

```bash
opendomain integrations validate
```

Profile discovery 遵循统一 Workspace Resolver：

1. 优先读取 canonical `opendomain/integrations/profiles/`；
2. `0.x` 期间仅存在 legacy `domain/` 时兼容读取并给出 warning；
3. 两个根目录同时存在时只读取 canonical registry，不合并；
4. 只读取所选目录第一层的 `.yaml` 和 `.yml` 普通文件；
5. 不跟随 Profile 目录或文件 symlink。

`opendomain init` 会创建空的 `opendomain/integrations/profiles/` 插槽和说明文件，
但不会生成假定外部格式的默认 Profile。

## 3. File Source Unit 与 Native Mapping

当外部工具已经有明确的结构化领域引用字段时，使用 Native Mapping。

外部文件：

```yaml
# external-features/order-cancellation.yaml
intent:
  id: external.order-cancellation
  name: Order Cancellation from Structured Planning
  status: proposed
domain:
  concepts:
    - sales.order
  rules:
    - sales.confirmed-order-cannot-be-deleted
  lifecycles:
    - sales.order-lifecycle
  events:
    - sales.order-confirmed
```

对应 Profile：

```yaml
# opendomain/integrations/profiles/structured-feature.yaml
schema_version: "1.0"
id: structured-feature
source_type: structured-feature
source_unit:
  kind: file
  match:
    paths:
      - external-features/*.yaml
intent:
  id:
    from: primary.intent.id
  name:
    from: primary.intent.name
  status:
    from: primary.intent.status
    default: proposed
references:
  mode: native
  affects_domain:
    concepts:
      from: primary.domain.concepts
      coerce: array
    rules:
      from: primary.domain.rules
    lifecycles:
      from: primary.domain.lifecycles
    events:
      from: primary.domain.events
```

File Source Unit 的 `input_path`、`root_path` 和 `primary` member 都是同一个
workspace-relative 普通文件。输入必须匹配至少一个 `paths` glob。

Native Mapping 只传递来源中已经明确存在的 ID。`coerce: array` 只能把一个显式
string 转成单元素数组，不能从描述文本或路径发明 ID。

## 4. Bundle Source Unit 与 Sidecar Declaration

当外部规划格式没有领域引用字段，或者不应修改其原生文件时，可以在一个受限
bundle 内增加严格的 Sidecar Domain Declaration。

示例目录：

```text
changes/add-order-cancellation/
  change.yaml
  feature.md
  opendomain.yaml
```

Profile：

```yaml
schema_version: "1.0"
id: structured-change-sidecar
source_type: structured-change
source_unit:
  kind: bundle
  match:
    paths:
      - changes/**
    root_marker: change.yaml
  members:
    primary:
      path: feature.md
      required: true
    manifest:
      path: change.yaml
      required: true
    declaration:
      path: opendomain.yaml
      required: true
intent:
  id:
    from: manifest.change.id
  name:
    first_of:
      - manifest.change.name
      - primary.title
  status:
    from: manifest.change.status
    default: proposed
references:
  mode: sidecar
```

Manifest：

```yaml
change:
  id: change.add-order-cancellation
  name: Add Order Cancellation
  status: proposed
```

Sidecar Declaration：

```yaml
schema_version: "1.0"
affects_domain:
  concepts:
    - sales.order
  rules:
    - sales.confirmed-order-cannot-be-deleted
  lifecycles:
    - sales.order-lifecycle
  events: []
```

Declaration 只能包含 `schema_version` 和四个 `affects_domain` 数组，且至少一个
数组非空。它不能包含 intent、source、status、metadata、Profile 设置或领域定义。

Bundle 输入可以是 bundle root，也可以是其中的 descendant。Runtime 向上查找
最近的精确 `root_marker`，但不会越过项目边界。它只读取 Profile 中声明的精确
member path，忽略 bundle 内其他文件。

## 5. 支持的结构化读取

Source Unit member 仅支持：

| 扩展名 | 可供 selector 使用的内容 |
| --- | --- |
| `.md` | YAML front matter；正文完全忽略 |
| `.yaml` / `.yml` | 一个安全 YAML mapping |
| `.json` | 一个 JSON object |

三种格式都会进入同一 hardened structured-data boundary。重复 key、anchor、
alias、tag、merge key、prototype-sensitive key、非字符串 mapping key 和非 JSON
值都会失败。

Profile v1 的 field path 以 member role 开头，例如
`primary.intent.id` 或 `manifest.change.name`。字段名只能包含字母、数字、
下划线和连字符。

## 6. 支持的映射操作

Profile v1 只支持以下操作：

| 操作 | 用途 | 限制 |
| --- | --- | --- |
| `from` | 读取一个结构化字段 | 必须从已配置 member role 开始 |
| `first_of` | 按声明顺序读取第一个存在的字段 | 不合并多个值 |
| `default` | intent 字段缺失时使用 literal | 不能用于领域引用 |
| `coerce: array` | 把显式 string 引用转成单元素数组 | 只能用于 reference selector |

允许的输出目标只有：

- `intent.id`
- `intent.name`
- `intent.status`
- `affects_domain.concepts`
- `affects_domain.rules`
- `affects_domain.lifecycles`
- `affects_domain.events`

三个 intent 字段都必须得到非空 string。四类 reference 至少有一个显式 ID；
数组会按第一次出现的顺序去重。

Profile v1 不支持 JavaScript、shell、npm package、template、regular expression、
environment interpolation、LLM、NLP、数组合并、enum mapping 或从路径派生 intent。

## 7. Profile 选择

显式选择本地 Profile：

```bash
opendomain prepare --profile structured-feature <path>
```

显式使用 built-in OpenSpec adapter：

```bash
opendomain prepare --integration openspec <feature-spec-or-dir>
```

不指定选择参数时，OpenDomain 会同时探测 built-in adapter 和有效本地 Profile：

- 恰好一个匹配时使用该 adapter；
- 没有本地 Profile 匹配时保留原有 OpenSpec 行为；
- 多个 Profile，或 OpenSpec 与 Profile 同时匹配时失败并列出全部 ID；
- 不按 built-in 身份、文件顺序或“最佳匹配”静默决定；
- `--profile` 与 `--integration` 同时出现时，在读取输入前失败。

自动模式会校验本地 registry。若无关 Profile 已损坏，先运行
`opendomain integrations validate` 修复，或对 OpenSpec 输入显式使用
`--integration openspec`。

## 8. 路径与安全边界

- Profile glob 必须是 project-workspace-relative，不能是绝对路径、包含 `..`
  或反斜杠。
- Bundle marker 和 member 必须是规范化的精确相对路径。
- 输入、marker 和 member 都会经过 realpath confinement。
- 任一路径通过 symlink 逃出项目或 bundle 时，prepare 失败。
- Profile Runtime 不扫描未声明正文，不执行 Profile 中的代码，也不访问网络。
- Schema unknown fields 失败；未知 `schema_version` 和 acquisition mode 失败。

这些限制让 Profile 保持为可 review 的声明式适配层，而不是项目内的任意代码执行
插件。

## 9. CLI 与 JSON

列出可用 integration：

```bash
opendomain integrations list
opendomain integrations list --json
```

验证 registry：

```bash
opendomain integrations validate
opendomain integrations validate --json
```

JSON inspection 包含：

- `workspace` 与 `workspace_mode`
- `profile_directory`
- `profile_file_count`
- `valid_profile_count`
- built-in 和 Profile `integrations`
- `warnings`
- `errors`

Profile prepare 继续输出 Grounding Protocol v1 的稳定字段。可选
`grounding_request.integration` metadata 会记录 Profile ID、选择方式、Profile
文件和去除绝对路径后的 Source Unit descriptor；consumer 不应把这些可选字段当成
accepted domain knowledge。

## 10. 当前边界

当前版本还不支持：

- Embedded Domain Declaration；
- 动态或可执行插件；
- built-in Spec Kit adapter；
- 自动生成、接受或提升 Candidate；
- 自动安装 Agent 指令；
- Profile reference index；
- EchoPath consumer conformance。

这些能力需要后续独立验证。新增兼容格式应优先写一个 repository-local Profile，
不能扩展或绕过 Grounding Protocol 的核心范式。
