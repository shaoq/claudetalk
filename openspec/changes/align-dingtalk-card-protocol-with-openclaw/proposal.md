## Why

当前 ClaudeTalk 的钉钉卡片链路已经能稳定拿到 `createAndDeliver` 与 `PUT /card/instances` 的成功响应，但真实私聊实验仍然表现为“首屏卡片空白”。既然固定文本实验已经绕过 Claude 且模板字段 key 也确认是 `content`，问题就不再是流式解析，而是当前卡片创建/更新协议与钉钉参考实现和模板契约之间仍存在偏差，需要单独收敛并对齐。

## What Changes

- 对齐 ClaudeTalk 与 `dingtalk-openclaw-connector` 的钉钉 AI 卡片协议模型，重点覆盖私聊目标标识、创建请求体、实例标识提取和更新请求体
- 明确卡片创建成功后的运行时上下文，除 `outTrackId` 外补齐后续更新所依赖的卡片实例标识与必要元数据
- 修正卡片更新请求，使其显式表达“按 key 更新卡片数据”的语义，并与参考实现/官方文档保持一致
- 增加协议级验证要求，用真实固定文本实验区分“模板字段契约错误”和“卡片协议不兼容”两类问题

## Capabilities

### New Capabilities
- `dingtalk-card-protocol-alignment`: 定义 ClaudeTalk 的 AI 卡片创建与更新协议如何与钉钉参考实现及官方契约保持一致，确保首屏文本和后续更新都能被同一模板正确渲染

### Modified Capabilities

## Impact

- `src/dingtalk.ts`: `createAICard` / `streamAICard` 的请求体、响应解析和运行时卡片实例模型需要调整
- `src/index.ts`: 卡片实验与正式卡片回复路径需要传递并使用更完整的卡片上下文
- `src/types.ts`: AI 卡片创建/更新请求与响应类型需要扩展到协议实际所需的字段
- 钉钉 AI 卡片接口：`/v1.0/card/instances/createAndDeliver` 与 `PUT /v1.0/card/instances`
- 回归验证：需要用真实私聊固定文本实验验证“阶段一可见、阶段二可更新”这两个最小结果
