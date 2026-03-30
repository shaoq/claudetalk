## Why

当前 ClaudeTalk 在收到用户消息后，会先额外发送一条“👍 收到，正在处理...”确认消息，再继续进入最终回复或卡片流式输出。这个首条应答不承担协议 ACK 职责，只会增加一次冗余触达，在卡片模式下还会造成“先 markdown 再卡片”的重复观感。

## What Changes

- 移除 markdown 模式下收到消息后立即发送的“收到，正在处理...”确认消息。
- 移除 card 模式下创建 AI 卡片前通过 `sessionWebhook` 发送的同类确认消息。
- 统一消息回复流程，收到消息后直接进入最终回复路径或卡片创建路径，不再插入独立的处理中提示。
- 同步更新相关 OpenSpec 文档，删除把“先发收到确认”视为既定行为的描述。

## Capabilities

### New Capabilities
- `message-reply-flow`: 规范 ClaudeTalk 收到消息后的回复时序，要求系统直接进入最终回复或卡片渲染流程，而不是先发送独立的处理中确认消息。

### Modified Capabilities

## Impact

- `src/index.ts`: 需要调整 markdown 与 card 两条回复分支，删除首条确认消息发送逻辑。
- `openspec/changes/streaming-card-output/`: 需要更新 proposal、design、tasks 中对“先发收到确认”的历史描述。
- 钉钉用户体验：用户将只看到最终 markdown 回复或 AI 卡片，不再看到额外确认消息。
