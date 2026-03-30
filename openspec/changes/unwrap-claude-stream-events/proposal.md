## Why

当前 ClaudeTalk 已经能成功创建钉钉卡片并启动 Claude 的 `stream-json` 流，但中间的流式正文仍无法更新到卡片上。最新真实样本表明，Claude CLI 的正文增量事件主要包裹在顶层 `type: "stream_event"` 结构内，而当前解析器只识别顶层 `assistant`、`content_block_delta` 和 `result`，导致所有中间增量都被忽略，最终只能在结束时一次性显示完整结果。

## What Changes

- 为 Claude `stream-json` 输出增加 `stream_event` 包装事件的解包逻辑
- 在解包后的内层事件中，仅将 `content_block_delta.delta.type === "text_delta"` 视为用户可见正文增量
- 明确排除 `thinking_delta` 和其他非正文内层事件，避免把思考内容或元数据推送到钉钉卡片
- 调整流式事件类型定义，使其反映顶层包装事件与内层真实事件的关系

## Capabilities

### New Capabilities
- `claude-stream-event-unwrapping`: 定义 Claude `stream-json` 中 `stream_event` 包装事件的解包规则，以及正文 `text_delta` 的识别要求

### Modified Capabilities

## Impact

- `src/index.ts`: `callClaude` 的逐行 NDJSON 解析逻辑，需要在解析前对 `stream_event` 进行解包
- `src/types.ts`: Claude 流式事件类型需增加 `stream_event` 包装层和内层事件结构
- Claude CLI 依赖：当前 `--output-format stream-json --include-partial-messages` 的真实事件封装格式
- 钉钉卡片流式体验：中间正文增量能否实时显示取决于这层解包
