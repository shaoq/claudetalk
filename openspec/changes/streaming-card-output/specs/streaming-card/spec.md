## ADDED Requirements

### Requirement: 流式卡片配置
系统 SHALL 支持通过 `.claudetalk.json` 配置文件或环境变量启用流式卡片模式。配置字段包括 `messageType`（值为 `card` 时启用）、`cardTemplateId`（钉钉卡片模板 ID）、`cardTemplateKey`（模板内容字段名，默认 `content`）。

#### Scenario: 通过配置文件启用卡片模式
- **WHEN** `.claudetalk.json` 中 `messageType` 为 `"card"` 且 `cardTemplateId` 非空
- **THEN** 系统使用流式卡片模式回复消息

#### Scenario: 未配置卡片模式时使用 markdown
- **WHEN** `.claudetalk.json` 中 `messageType` 为 `"markdown"` 或未设置
- **THEN** 系统使用现有 sessionWebhook markdown 方式回复（行为不变）

#### Scenario: 配置了 card 但缺少 templateId
- **WHEN** `messageType` 为 `"card"` 但 `cardTemplateId` 为空
- **THEN** 系统降级为 markdown 模式并输出警告日志

### Requirement: 流式输出处理
系统 SHALL 使用 `claude -p --output-format stream-json` 调用 Claude CLI，逐行解析 NDJSON 输出，实时提取文本增量内容。

#### Scenario: 正常流式输出
- **WHEN** Claude CLI 输出包含 `type: "assistant"` 且 `subtype: "text"` 的增量事件
- **THEN** 系统提取 `text` 字段作为增量内容，累积到完整响应中

#### Scenario: 忽略非文本事件
- **WHEN** Claude CLI 输出包含非文本类型的事件（如 `type: "system"`、工具调用等）
- **THEN** 系统忽略该事件，不中断流式处理

#### Scenario: 流式输出完成
- **WHEN** Claude CLI 输出 `type: "result"` 事件（进程结束前的最终事件）
- **THEN** 系统从该事件中提取 `session_id` 并保存到 sessionMap，标记流式输出完成

### Requirement: 实时更新钉钉卡片
系统 SHALL 在卡片模式下，将流式累积的文本实时推送到钉钉 AI 卡片，实现打字机效果。

#### Scenario: 创建卡片并开始流式更新
- **WHEN** 收到用户消息且配置为卡片模式
- **THEN** 系统先调用 `createAICard` 创建卡片，随后在每次累积到新的文本增量时调用 `streamAICard` 更新卡片内容

#### Scenario: 流式更新节流
- **WHEN** 文本增量到达频率高于 200ms
- **THEN** 系统 SHALL 累积增量文本，以不超过每 200ms 一次的频率调用 `streamAICard`

#### Scenario: 流式输出结束
- **WHEN** Claude CLI 流式输出完成
- **THEN** 系统调用 `streamAICard(card, fullContent, true)` 标记卡片更新完成

### Requirement: 流式错误兜底
系统 SHALL 在流式输出过程中发生错误时，将已累积的部分内容发送给用户。

#### Scenario: Claude 进程中途异常退出
- **WHEN** `claude -p` 进程在流式输出过程中非正常退出（exit code 非 0）
- **THEN** 系统将已累积的部分文本通过 `streamAICard(isFinalize: true)` 发送，并在卡片内容末尾追加错误提示

#### Scenario: 钉钉流式 API 调用失败
- **WHEN** `streamAICard` 调用返回错误
- **THEN** 系统记录错误日志，继续尝试后续更新，最终仍以 `isFinalize: true` 结束卡片

### Requirement: 配置向导支持卡片模板
系统 SHALL 在交互式配置向导（`--setup`）中增加卡片模板 ID 的配置选项。

#### Scenario: 配置卡片模板
- **WHEN** 用户运行 `claudetalk --setup --local` 且选择启用卡片模式
- **THEN** 向导提示输入 `cardTemplateId` 和 `cardTemplateKey`（可选，默认 `content`）

#### Scenario: 跳过卡片配置
- **WHEN** 用户在向导中不输入卡片模板 ID
- **THEN** 系统默认使用 markdown 模式
