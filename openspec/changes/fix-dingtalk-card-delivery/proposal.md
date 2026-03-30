## Why

`streaming-card-output` 接入后，ClaudeTalk 在钉钉私聊场景创建 AI 卡片时返回 `param.openSpaceIdInvalid`，导致卡片模式无法真正投放。当前实现将入站消息的 `conversationId` 直接作为 `openSpaceId` 使用，且未按私聊/群聊场景构造对应的投放模型，说明现有卡片投放协议适配不完整，需要补齐后才能让流式卡片能力可用。

## What Changes

- 修正钉钉 AI 卡片创建请求的会话上下文解析，区分私聊与群聊场景生成正确的 `openSpaceId`
- 在卡片创建请求中补齐与场景匹配的投放模型字段，避免仅传模板和内容导致接口校验失败
- 调整卡片创建相关类型定义，使请求字段与实际接口保持一致，减少后续误用
- 修正卡片创建接口的成功判定与错误日志，避免接口实际成功时被误判为失败
- 为卡片投放增加场景化验证要求，覆盖私聊、群聊和异常响应三类关键路径

## Capabilities

### New Capabilities
- `dingtalk-card-delivery`: 钉钉 AI 卡片投放能力，定义不同会话场景下卡片创建请求的空间标识、投放模型和错误处理要求

### Modified Capabilities

（无已有 specs 需要修改）

## Impact

- **`src/dingtalk.ts`**: `createAICard` 的入参与请求体需要按会话场景重构
- **`src/index.ts`**: 卡片模式调用点需要传递创建卡片所需的完整上下文，而不只是 `chatId`
- **`src/types.ts`**: AI 卡片创建请求和相关上下文类型需要补齐并纠正
- **验证流程**: 需要补充私聊/群聊卡片投放的回归验证，确保 `streaming-card-output` 可以在真实场景使用
