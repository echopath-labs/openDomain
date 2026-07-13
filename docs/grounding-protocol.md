# Grounding Protocol v1

Grounding Protocol 是 OpenDomain 面向外部规格工具和 Agent consumer 的稳定、
tool-neutral 契约。它接收 Grounding Request，读取 accepted OpenDomain source，
然后生成 Grounding Pack。

```text
OpenSpec / Spec Kit / other structured source
  -> Adapter or Profile Runtime
  -> Grounding Request
  -> Grounding Protocol
  -> Grounding Pack
  -> Codex / EchoPath / other consumer
```

Profile Runtime 负责格式适配，不属于稳定协议。Grounding Pack 也不是 source of
truth；accepted OpenDomain Markdown 文件仍然决定业务语义。

## Version

当前协议版本：

```yaml
protocol_version: "1.0"
```

兼容性只覆盖本页列出的稳定字段。alpha 阶段已有的 OpenSpec convenience
metadata 会继续输出，但 consumer 不应依赖它们作为 Grounding Protocol 的必要字段。

## Grounding Request

稳定字段：

```yaml
protocol_version: "1.0"
source:
  type: openspec
  path: examples/erp/openspec/changes/order-cancellation/spec.md
intent:
  id: spec.order-cancellation
  name: Order cancellation
  status: proposed
affects_domain:
  concepts:
    - sales.order
  rules: []
  lifecycles: []
  events: []
```

Grounding Request 只引用 OpenDomain ID，不复制业务定义，也不代表 accepted truth。

## Grounding Pack

稳定字段：

- `protocol_version`
- `grounding_request`
- `read_first`
- `candidate_boundaries`
- `context_budget`
- `errors`
- `warnings`

成功和失败输出都保留这些字段。请求构造失败时，`grounding_request` 为 `null`，
两个 source collection 为空，诊断写入 `errors`。

使用 JSON 输出：

```bash
npm run opendomain -- prepare \
  examples/erp/openspec/changes/order-cancellation/spec.md \
  --json
```

## Semantic Closure

Grounding Request 中的 `affects_domain` 是 declared roots。OpenDomain 使用
`opendomain.semantic-closure` version `1` 补齐必须读取的 accepted semantics。

v1 只遍历以下结构化引用字段：

- `context`
- `rules[]`
- `lifecycles[]`
- `events[]`
- `applies_to[]`
- `related_rules[]`
- `related_lifecycle[]`
- `related[].target`

遍历是确定性的、cycle-safe，并按 ID 返回稳定顺序。它不扫描正文、不推断 ID、
不遍历 Candidate。`prepare` 与 Semantic Retrieval Index query 使用同一实现和
policy version。

`semantic_closure.selection_paths` 是可选解释信息，用于说明某个 transitive ID
为什么进入 `read_first`；它不是 accepted domain knowledge。

## Candidate Boundary

Candidate 如果指向 declared root 或 closure 选中的 accepted object，会出现在
`candidate_boundaries`。Candidate 不会进入 `read_first`，也不会因为生成 Grounding
Pack 而被提升为 accepted knowledge。

## Context Budget

Context Budget 是 advisory estimate，不是 grounding selection policy。

```json
{
  "estimator": { "id": "chars-div-4", "version": "1" },
  "advisory": true,
  "required": {
    "source_count": 5,
    "estimated_tokens": 1200
  },
  "optional_candidates": {
    "source_count": 1,
    "estimated_tokens": 250
  },
  "total_possible_estimated_tokens": 1450
}
```

version `1` 对每个 unique complete source file 使用
`ceil(JavaScript string length / 4)`。它不是 model-specific tokenizer 结果。

无论 estimate 多大，OpenDomain 都不会自动删除 accepted source、隐藏 Candidate、
截断文件或改变 closure。

## Schemas

- `schemas/grounding-request.schema.json`
- `schemas/grounding-pack.schema.json`

Schema 允许额外的 compatibility metadata，但 consumer conformance 应只要求稳定
字段。
