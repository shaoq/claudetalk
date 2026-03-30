## Why

当前 ClaudeTalk 的卡片模式已经能正确识别卡片创建失败并降级到 Markdown，但私聊场景的 `createAndDeliver` 请求仍持续返回 `spaces of card is empty`。这说明问题已经收敛到钉钉 AI 卡片创建 payload 本身，需要按官方示例对齐字段结构，才能真正让流式卡片进入首屏创建成功路径。

## What Changes

- 对齐钉钉 AI 卡片 `createAndDeliver` 的请求体结构，改用官方示例使用的场景化 open space model 与 deliver model 字段
- 移除当前实现中与官方示例不一致或未经验证的卡片创建字段，避免服务端无法解析有效投放空间
- 调整 AI 卡片请求类型定义，使其准确反映当前实际发送的 payload 结构
- 增加针对私聊与群聊卡片创建 payload 的验证要求，确保流式卡片链路的首步可用

## Capabilities

### New Capabilities
- `dingtalk-card-create-payload`: 定义钉钉 AI 卡片 `createAndDeliver` 请求体在私聊和群聊场景下的官方兼容结构

### Modified Capabilities

## Impact

- `src/dingtalk.ts`: `createAICard` 的 payload 构造逻辑需要按官方示例重构
- `src/types.ts`: AI 卡片创建请求类型需要改为场景化 `imRobotOpenSpaceModel` / `imGroupOpenSpaceModel` 结构
- 钉钉 AI 卡片接口：`/v1.0/card/instances/createAndDeliver`
- 验证流程：需要用真实私聊场景验证卡片首屏创建能否成功
