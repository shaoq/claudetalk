## Context

通过真实本机样本已经确认，当前 Claude CLI 的 `stream-json` 输出并不是简单的顶层 `content_block_delta` 或顶层 `assistant`。真正的正文增量主要来自：

- 顶层 `type: "stream_event"`
- 其内部 `event.type: "content_block_delta"`
- 且 `event.delta.type: "text_delta"`

同一条流里还会出现大量不应展示给用户的事件，例如：

- `stream_event.event.type = content_block_delta` 且 `delta.type = thinking_delta`
- `stream_event.event.type = message_start / message_stop / content_block_start / content_block_stop`
- 顶层 `system`

当前实现的问题不是“没有流事件”，而是只看顶层 `type`，没有先解包 `stream_event.event`。因此所有中间正文都被记成 `Unhandled event type: stream_event`，最后只能靠顶层 `assistant` 快照或顶层 `result` 一次性补出最终内容。

## Goals / Non-Goals

**Goals:**
- 在 `callClaude` 中先解包顶层 `stream_event`，再基于内层真实事件做正文提取
- 只把 `text_delta` 作为用户可见正文增量
- 排除 `thinking_delta` 和其他非正文内层事件，避免泄露思考内容或污染卡片
- 保留当前已经有效的顶层 `assistant` 快照和顶层 `result` 处理路径

**Non-Goals:**
- 不修改钉钉卡片创建和卡片更新接口
- 不重新设计节流器或卡片模板
- 不改动 Claude CLI 参数组合，除非实现时发现新的样本需要额外标志

## Decisions

### 1. 先归一化顶层事件，再做现有解析

**选择**: 对每一行 NDJSON 先做事件归一化：
- 若顶层 `type === "stream_event"` 且存在 `event`，则以 `event` 作为实际待解析事件
- 否则直接使用顶层事件

**替代方案**: 在每个提取函数里分别兼容 `stream_event`

**理由**: 解包属于通用步骤，放在入口更清晰，也能避免在多个提取函数里重复判断包装层。

### 2. 正文增量只接受 `text_delta`

**选择**: 在 `content_block_delta` 里，仅当 `delta.type === "text_delta"` 且存在 `delta.text` 时，才把文本计入 `accumulatedText`。

**替代方案**: 继续把任意 `content_block_delta` 中的文本字段都当正文

**理由**: 真实样本已经证明 `thinking_delta` 和 `text_delta` 共用同一事件类型。如果不按 `delta.type` 过滤，就会把思考内容误推到钉钉卡片。

### 3. 顶层 assistant 快照只作为补充，不作为主要流式来源

**选择**: 保留 `assistant.message.content[]` 快照事件解析，但将其视为“当前完整快照”，用于替换已累积文本，而不是替代 `text_delta` 作为主要流式路径。

**替代方案**: 只依赖 assistant 快照，不解析 text_delta

**理由**: 快照事件能保证最终一致性，但流式体验最好的仍然是增量 `text_delta`。两者结合可以兼顾实时性和稳健性。

## Risks / Trade-offs

- **[未来 CLI 继续调整包装层]** → 顶层包装结构可能再变化。缓解：将归一化步骤集中封装，并保留原始顶层类型日志。
- **[快照与增量重复更新]** → 同时处理 `text_delta` 和 `assistant` 快照可能造成重复刷新。缓解：快照事件采用“覆盖 accumulatedText”而非追加。
- **[thinking 内容误入正文]** → 如果 `delta.type` 过滤不严，可能把思考文本展示给用户。缓解：明确只接受 `text_delta`。

## Migration Plan

1. 更新 OpenSpec 工件，明确 `stream_event` 解包和 `text_delta` 过滤规则
2. 扩展 `src/types.ts` 的流式事件类型，表达顶层包装事件与内层事件
3. 在 `src/index.ts` 中增加统一事件归一化逻辑
4. 调整文本提取函数，只在内层 `text_delta` 事件中提取正文增量
5. 用真实 Claude stdout 样本回归，确认卡片中间正文开始持续更新

## Open Questions

- 顶层 `assistant` 快照事件是否始终会在正文结束时出现，还是某些模型/版本只提供 `result`，实现时需要继续保留三层兜底。
- 是否需要临时增加更精细的 debug 日志，例如第一次遇到未知内层事件时打印完整 JSON，便于后续协议漂移定位。
