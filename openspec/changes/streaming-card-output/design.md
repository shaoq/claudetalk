## Context

ClaudeTalk 当前通过 `child_process.spawn('claude', ['-p', '--output-format', 'json'])` 调用 Claude CLI，等待进程完整退出后一次性返回 JSON 结果，再通过钉钉 sessionWebhook 以 markdown 格式回复。整个流程是同步阻塞的。

钉钉客户端（`dingtalk.ts`）已实现 `createAICard()` 和 `streamAICard()` 两个 API 方法，但未被 `index.ts` 的回复流程调用。用户已在钉钉开放平台创建了 AI 卡片模板，具备了启用流式卡片的条件。

关键约束：
- `claude -p` 支持 `--output-format stream-json`，输出 NDJSON 格式（每行一个 JSON 对象），包含 `content_block_delta` 等增量事件
- 钉钉流式卡片 API：先 `createAndDeliver` 创建卡片，再多次调用 `card/streaming` (PUT) 更新内容，最后 `isFinalize: true` 结束
- 当前 `callClaude` 是 Promise<string> 模式，返回完整文本

## Goals / Non-Goals

**Goals:**
- 在卡片模式下实现打字机效果的流式输出
- 保持 markdown 模式的向后兼容（默认行为不变）
- 复用已有的 `createAICard` / `streamAICard` API 实现
- 配置方式与现有 `.claudetalk.json` 体系一致

**Non-Goals:**
- 不改造 `callClaude` 函数本身的签名，而是在其基础上扩展流式回调
- 不改变会话管理（session key、持久化）逻辑
- 不处理图片/文件等富媒体的流式场景，仅限文本

## Decisions

### 1. 使用 `--output-format stream-json` 替代 `json`

**选择**: 在卡片模式下使用 `stream-json`，逐行读取 stdout 解析增量内容
**替代方案**: 使用 `--output-format json` 但分片发送 — 不现实，因为必须等进程结束才能拿到结果
**理由**: `stream-json` 是 Claude CLI 原生支持的流式格式，每行输出一个 JSON 事件对象，包含 `type`、`subtype`、`delta` 等字段，可实时提取文本增量

### 2. 流式回调架构：`callClaude` 新增 `onChunk` 回调参数

**选择**: 给 `callClaude` 添加可选的 `onChunk(text: string, isFinal: boolean)` 回调参数。当传入回调时，使用 `stream-json` 格式，每解析到一个文本增量就调用回调。
**替代方案**: 单独新建 `callClaudeStreaming` 函数 — 会造成大量代码重复
**理由**: 最小化改动，通过参数区分流式/非流式模式，核心 spawn 逻辑复用

### 3. 回复流程分支：卡片模式 vs markdown 模式

**选择**: 在 `index.ts` 的 `onMessage` handler 中，根据配置决定回复路径：
- **卡片模式**: 直接调用 `createAICard` 创建卡片 → 调用 `callClaude(message, { onChunk })` → 每次 chunk 调用 `streamAICard` → 最终 `streamAICard(isFinalize: true)` 结束
- **markdown 模式**: 保持现有 sessionWebhook 逻辑不变

**理由**: 两种模式的消息发送机制完全不同（卡片 API vs webhook），分支比抽象更清晰

### 4. 流式节流（Throttling）

**选择**: 对 `streamAICard` 调用做节流，间隔不低于 200ms，累积增量后批量更新
**理由**: Claude CLI 的 token 输出速度可能很快（每秒数十个 delta），每个 delta 都调一次钉钉 API 会触发限频。200ms 间隔在用户感知上仍然是"实时"的，同时大幅减少 API 调用次数

### 5. 配置集成

**选择**: 在 `.claudetalk.json` 中增加 `messageType`、`cardTemplateId`、`cardTemplateKey` 字段，同时支持环境变量覆盖
**理由**: 与现有配置优先级链一致（本地配置 > 全局配置 > 环境变量）

## Risks / Trade-offs

- **[流式中断]** → 如果 `claude -p` 进程中途崩溃或网络断开，卡片会停留在不完整状态。缓解：在 `child.on('error')` / 非 0 退出时，用当前已累积的内容调用 `streamAICard(isFinalize: true)` 兜底结束卡片
- **[钉钉 API 限频]** → 流式更新过于频繁可能触发限频。缓解：200ms 节流 + 错误重试
- **[stream-json 格式兼容性]** → Claude CLI 版本更新可能改变流式输出格式。缓解：只关注 `type === 'assistant'` + `subtype === 'text'` 的事件，忽略未知类型
- **[session_id 获取]** → 流式模式下 `session_id` 在最终事件中才出现。缓解：在流式结束事件中保存 session_id，与现有持久化逻辑兼容
