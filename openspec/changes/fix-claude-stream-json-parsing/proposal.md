## Why

当前流式卡片链路已经可以成功创建钉钉卡片并启动 Claude 的 `stream-json` 输出，但正文事件解析仍然过于狭窄，导致系统无法识别真实的文本增量事件。结果是卡片没有收到流式正文，进程结束时又把整段原始 NDJSON 事件流误当成最终回复文本返回，直接破坏了卡片与 Markdown 两条回复路径。

## What Changes

- 扩展 Claude `stream-json` 事件解析逻辑，兼容当前 CLI 真实输出的正文增量事件结构
- 区分系统事件、工具事件和正文事件，避免把非正文流式事件计入用户可见回复
- 修正流式模式结束时的 fallback，禁止在未解析到正文时将原始 NDJSON 输出当作最终回复文本
- 为流式空正文、仅系统事件、正常正文流三类情况增加明确处理要求

## Capabilities

### New Capabilities
- `claude-stream-json-parsing`: 定义 Claude `stream-json` 输出在正文提取、事件过滤和结束兜底方面的解析要求

### Modified Capabilities

## Impact

- `src/index.ts`: `callClaude` 中的 NDJSON 逐行解析、文本累积与流式结束兜底逻辑
- `src/types.ts`: Claude 流式事件类型需要补充真实事件结构
- Claude CLI 依赖：`--output-format stream-json --verbose` 的当前输出格式
- 卡片与 Markdown 回复路径：都会受到最终文本提取逻辑的影响
