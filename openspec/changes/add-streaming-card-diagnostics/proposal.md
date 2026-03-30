## Why

当前流式卡片链路已经能够成功创建卡片、解包 Claude `stream_event`、并在结束时拿到正确的最终文本，但仍无法判断中间的正文增量是否真正触发了钉钉卡片更新。由于缺少 `text_delta`、`onChunk(false)` 和 `streamAICard()` 成功路径的观测日志，系统无法区分“技术上没有中间更新”和“技术上有更新但用户体感不明显”这两种完全不同的问题。

## What Changes

- 为 Claude `content_block_delta` 增加更细粒度的诊断日志，记录 `delta.type`、文本长度和关键时间点
- 为 `onChunk(false)` 和节流器路径增加观测点，确认中间正文是否被推入卡片更新链路
- 为钉钉 `streamAICard()` 成功返回增加日志，记录更新时间、文本长度和响应摘要
- 将这些诊断日志定义为临时排障能力，用于区分“解析问题”“更新调用问题”和“体感问题”

## Capabilities

### New Capabilities
- `streaming-card-diagnostics`: 定义流式卡片链路在正文提取、节流更新和钉钉更新成功路径上的诊断日志要求

### Modified Capabilities

## Impact

- `src/index.ts`: Claude stream-json 解析循环、`onChunk(false)`、`throttledUpdate()` 的日志观测
- `src/dingtalk.ts`: `streamAICard()` 成功路径日志
- 排障流程：通过日志区分 text_delta 是否出现、是否触发中间更新、是否真正打到钉钉
