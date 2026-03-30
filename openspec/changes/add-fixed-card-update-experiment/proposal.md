## Why

当前日志已经证明 Claude 流式解析、正文提取和钉钉卡片更新调用都大概率成立，但用户侧仍然看到空白或不符合预期的卡片展示。这意味着下一步最有价值的动作不是继续调 Claude，而是引入一个完全绕过 Claude 的固定文本卡片更新实验，用最小链路验证钉钉模板是否真的会显示 `streamAICard()` 更新进去的字段。

## What Changes

- 增加一个固定文本卡片更新实验入口，不依赖 Claude 输出
- 允许在同一张卡上按固定时序发送创建文本和后续更新文本
- 通过该实验验证钉钉卡片是否能从固定文案 A 更新为固定文案 B
- 记录实验步骤日志，便于区分“模板字段绑定问题”和“流式体验问题”

## Capabilities

### New Capabilities
- `fixed-card-update-experiment`: 定义一个不依赖 Claude 的固定文本卡片创建与更新实验，用于验证模板显示契约

### Modified Capabilities

## Impact

- `src/index.ts` 或 `src/cli.ts`: 需要一个可触发实验的入口
- `src/dingtalk.ts`: 复用现有 `createAICard` / `streamAICard` 能力完成固定文本更新实验
- 验证流程：通过真实钉钉客户端直接观察模板是否显示创建文本与更新文本
