## Why

当前流式卡片链路在真实运行时存在两个阻塞问题：Claude CLI 的流式参数与当前版本不兼容，导致 `stream-json` 模式直接退出；钉钉 AI 卡片创建接口则会在投放失败时被误判为成功，掩盖真实错误并继续进入后续更新流程。需要先稳定这条基础运行链路，后续占位卡片和体验优化才有意义。

## What Changes

- 修正 Claude CLI 流式调用参数，使卡片模式在当前 CLI 版本下能够正常进入 `stream-json` 输出流程
- 收紧钉钉 AI 卡片创建成功判定，识别 HTTP 成功但业务投放失败的响应并立即中止流程
- 校准 AI 卡片创建与流式更新所依赖的请求字段和响应解析，避免继续使用缺失或无效的卡片标识
- 为卡片模式增加明确的降级与错误收敛行为，防止出现 `Created card: undefined` 后仍继续流式更新的假成功路径

## Capabilities

### New Capabilities
- `streaming-card-runtime`: 定义流式卡片模式下 Claude CLI 调用、钉钉卡片创建、流式更新和失败收敛的运行时正确性要求

### Modified Capabilities

## Impact

- `src/index.ts`: `callClaude` 的流式参数、卡片模式主流程、卡片失败后的降级策略
- `src/dingtalk.ts`: `createAICard` / `streamAICard` 的请求构造、成功判定、响应解析与错误处理
- `src/types.ts`: AI 卡片创建与流式更新相关响应/请求类型可能需要补齐
- Claude CLI 依赖：当前本机安装版本的 `--print --output-format stream-json` 约束
- 钉钉 AI 卡片接口：`createAndDeliver` 与 `card/streaming` 的实际响应语义
