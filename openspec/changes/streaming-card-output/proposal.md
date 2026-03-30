## Why

当前 ClaudeTalk 回复钉钉消息时，需要等待 `claude -p` 完整执行完毕后才能一次性发送结果。对于复杂问题，Claude 可能需要数分钟才能返回，等待期间缺少可持续刷新的反馈，体验较差。钉钉 AI 流式卡片支持逐 token 更新内容，可以实现类似 ChatGPT 的打字机效果，显著提升交互体验。

## What Changes

- 将 `claude -p` 的输出格式从 `json`（等待完整结果）改为 `stream-json`（逐行流式输出）
- 新增流式响应处理逻辑：逐行解析 Claude CLI 的 stdout，实时调用钉钉 `streamAICard` API 更新卡片内容
- 改造 `index.ts` 的回复流程：当配置为卡片模式时，走 `createAICard` → `streamAICard` 路径替代 sessionWebhook markdown 回复
- 将流式卡片所需的配置（`cardTemplateId`、`cardTemplateKey`）纳入 `.claudetalk.json` 配置体系，支持环境变量和配置文件两种方式

## Capabilities

### New Capabilities
- `streaming-card`: 流式卡片输出能力 — 从 Claude CLI 流式读取响应并实时更新钉钉 AI 卡片

### Modified Capabilities

（无已有 specs 需要修改）

## Impact

- **`src/index.ts`**: `callClaude` 函数需支持流式模式，新增流式响应回调机制；回复逻辑需分支处理卡片模式
- **`src/dingtalk.ts`**: `createAICard` 和 `streamAICard` 已实现，无需修改
- **`src/types.ts`**: 可能新增流式输出相关的类型定义
- **`src/cli.ts`**: 配置向导需增加卡片模板 ID 的配置项
- **配置文件**: `.claudetalk.json` 新增 `cardTemplateId`、`cardTemplateKey`、`messageType` 字段
- **Claude CLI 依赖**: 依赖 `claude -p --output-format stream-json` 的流式输出格式
