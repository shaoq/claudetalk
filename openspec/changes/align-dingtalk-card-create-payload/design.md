## Context

`stabilize-streaming-card-runtime` 已经把流式运行时链路修正为 fail-closed：卡片创建失败时会明确报错并降级到 Markdown，不再误判成功。最新真实日志显示，当前失败点稳定收敛在 `createAndDeliver` 返回的 `spaces of card is empty`。这意味着会话上下文、错误判定和流式 CLI 参数已不再是首要阻塞，真正的问题是卡片创建 payload 与钉钉官方示例存在结构偏差。

当前实现仍发送 `openSpaceModel` 与 `cardData.cardDataModel` 等字段；而钉钉官方示例在私聊/群聊场景使用的是 `imRobotOpenSpaceModel` / `imGroupOpenSpaceModel`、配套的 deliver model，以及以 `cardParamMap` 为主的卡片数据结构。因此需要在实现前先明确：这次变更不是继续扩大会话或运行时逻辑，而是只做 `createAndDeliver` 请求体协议对齐。

## Goals / Non-Goals

**Goals:**
- 让私聊和群聊的 AI 卡片创建 payload 与钉钉官方示例保持一致
- 去掉当前 payload 中未经验证、可能导致服务端无法生成有效投放空间的字段
- 让 `src/types.ts` 中的请求类型与运行时真实 payload 一致
- 为真实私聊场景创建卡片提供可回归验证的协议边界

**Non-Goals:**
- 不修改 Claude CLI 的流式参数或 session 恢复逻辑
- 不修改 `streamAICard` 的更新节流或卡片失败降级策略
- 不在本次变更中设计占位卡片文案或模板字段优化

## Decisions

### 1. 使用场景化 open space model 取代通用 `openSpaceModel`

**选择**: `createAICard` 请求体按场景改为：
- 私聊使用 `imRobotOpenSpaceModel`
- 群聊使用 `imGroupOpenSpaceModel`

**替代方案**: 保留当前 `openSpaceModel`，仅继续调整 `openSpaceId`

**理由**: 当前真实报错已经从 `openSpaceIdInvalid` 收敛到了 `spaces of card is empty`，说明服务端没有从现有 payload 中解析出有效 space。既然官方示例使用场景化 open space model，就应以其为准，而不是继续保留未被示例验证的通用字段。

### 2. 卡片创建数据先向官方最小可用结构收敛

**选择**: 在 `cardData` 中优先采用官方示例已经证明可用的 `cardParamMap` 结构，避免同时发送多个含义重叠的数据块。

**替代方案**: 继续保留 `cardDataModel`，只补 `cardParamMap`

**理由**: 目前首先要解决的是“卡片能否创建成功”。在协议未完全跑通前，同时保留多套数据结构只会增加服务端解析歧义。先向最小可用 payload 收敛，更利于用真实环境逐项验证。

### 3. 顶层请求体只保留官方示例明确使用的字段

**选择**: 以官方示例为准，保留 `openSpaceId`、场景化 open space model、场景化 deliver model、`cardTemplateId`、`outTrackId`、`cardData` 等必要字段；移除当前没有官方依据的顶层字段。

**替代方案**: 保留所有历史字段，寄希望于服务端忽略无关字段

**理由**: 当前服务端已经表现出对 payload 结构高度敏感。为了缩小变量范围，最稳妥的办法是让请求体尽可能贴近官方工作示例。

## Risks / Trade-offs

- **[官方示例与当前租户行为仍有差异]** → 即便结构对齐，某些企业应用配置差异仍可能影响投放。缓解：继续保留完整响应日志，优先验证私聊单场景。
- **[过度裁剪字段导致模板数据不完整]** → 如果模板实际依赖 `cardDataModel`，只发 `cardParamMap` 可能导致内容为空。缓解：本次先确保创建成功，必要时再追加模板数据字段，并通过真实返回逐步验证。
- **[与现有类型不兼容]** → 请求类型收缩后，可能影响当前 `streamAICard` 或其他调用点的复用假设。缓解：变更范围只收敛在 `createAICard` 请求和对应类型，不碰更新链路。

## Migration Plan

1. 更新 OpenSpec 工件，明确 `createAndDeliver` payload 的目标结构
2. 调整 `src/types.ts` 中 AI 卡片创建请求类型
3. 按官方示例重构 `src/dingtalk.ts` 中 `createAICard` 的请求体
4. 用真实私聊消息验证卡片首屏创建是否成功
5. 如私聊成功，再验证群聊路径是否也能产出有效投放空间

## Open Questions

- 你当前钉钉 AI 卡片模板是否必须依赖 `cardDataModel` 才能展示内容；如果是，则需要在创建成功后再逐步补回对应字段。
- 群聊场景是否还需要补 `atUserIds` 或其他群聊特有字段，还是官方最小 `imGroupOpenSpaceModel` / `imGroupOpenDeliverModel` 就足够。
