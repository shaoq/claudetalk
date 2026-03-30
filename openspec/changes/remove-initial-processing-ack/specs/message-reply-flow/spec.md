## ADDED Requirements

### Requirement: 消息处理时不得发送独立的处理中确认消息
系统 SHALL 在收到用户消息后直接进入最终回复流程，而不是额外发送独立的“收到，正在处理...”确认消息。

#### Scenario: Markdown 模式直接返回最终回复
- **WHEN** 系统收到用户消息且当前使用 markdown 回复模式
- **THEN** 系统 MUST 先执行 Claude 处理流程，并仅发送最终 markdown 回复

#### Scenario: Card 模式直接创建卡片
- **WHEN** 系统收到用户消息且当前使用 AI card 回复模式
- **THEN** 系统 MUST 直接创建 AI 卡片并进入后续流式更新流程，而不是先发送单独的 markdown 确认消息

### Requirement: 协议级 ACK 与用户可见回复分离
系统 SHALL 保持钉钉 Stream 回调所需的协议级 ACK，但该 ACK MUST 不转化为额外的用户可见消息。

#### Scenario: 回调到达时立即返回协议 ACK
- **WHEN** 系统收到钉钉 Stream CALLBACK 帧
- **THEN** 系统 MUST 立即返回协议要求的 ACK，并异步处理后续业务逻辑

#### Scenario: 删除首条确认消息不影响协议处理
- **WHEN** 系统已移除用户可见的“处理中”确认消息
- **THEN** 系统 MUST 仍然维持原有的 Stream ACK 行为与后续消息处理能力
