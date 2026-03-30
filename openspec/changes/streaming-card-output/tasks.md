## 1. 类型定义与配置扩展

- [x] 1.1 在 `types.ts` 中新增 `StreamChunk` 类型
- [x] 1.2 在 `types.ts` 的 `DingTalkChannelConfig` 中新增 `cardTemplateId`、`cardTemplateKey`、`messageType` 字段（已存在）
- [x] 1.3 在 `types.ts` 的 `ProfileConfig` 和 `ClaudeTalkConfig` 中新增 `messageType`、`cardTemplateId`、`cardTemplateKey` 字段
- [x] 1.4 在 `src/cli.ts` 配置向导中增加卡片模板 ID 和 message type 的交互式配置选项

## 2. callClaude 流式能力扩展

- [x] 2.1 定义 `CallClaudeOptions` 接口，包含可选的 `onChunk(text: string, isFinal: boolean): void` 回调
- [x] 2.2 修改 `callClaude` 函数签名，支持接收 `CallClaudeOptions`
- [x] 2.3 当 `onChunk` 存在时，使用 `--output-format stream-json` 替代 `json`
- [x] 2.4 逐行解析 `stream-json` 的 NDJSON 输出，提取文本增量
- [x] 2.5 累积文本增量，每次调用 `onChunk(accumulatedText, false)`
- [x] 2.6 处理 `type: "result"` 结束事件，提取 `session_id` 并保存，调用 `onChunk(fullText, true)`
- [x] 2.7 流式模式下进程异常退出时，用已累积内容调用 `onChunk(partialText, true)` 兜底

## 3. 钉钉卡片流式回复集成

- [x] 3.1 在 `startBot` 的 `onMessage` handler 中，根据 `config.messageType` 判断回复路径
- [x] 3.2 卡片模式：收到消息后直接调用 `createAICard` 创建卡片并开始流式回复
- [x] 3.3 卡片模式：实现节流器（200ms 间隔），累积增量后调用 `streamAICard` 更新卡片
- [x] 3.4 卡片模式：流式结束后调用 `streamAICard(card, fullContent, true)` 终止卡片
- [x] 3.5 卡片模式：错误场景下仍以 `isFinalize: true` 结束卡片，末尾追加错误提示
- [x] 3.6 markdown 模式保持现有逻辑不变（sessionWebhook 回复）

## 4. 配置加载与优先级

- [x] 4.1 修改 `index.ts` 中 `loadConfig` 和配置读取逻辑，支持从配置文件中读取 `messageType`、`cardTemplateId`、`cardTemplateKey`
- [x] 4.2 环境变量 `DINGTALK_MESSAGE_TYPE`、`DINGTALK_CARD_TEMPLATE_ID`、`DINGTALK_CARD_TEMPLATE_KEY` 作为兜底
- [x] 4.3 配置了 `messageType: "card"` 但 `cardTemplateId` 为空时，降级为 markdown 并输出警告日志

## 5. 测试与验证

- [ ] 5.1 验证 markdown 模式行为不变（回归测试）
- [ ] 5.2 配置卡片模板后，验证流式卡片输出效果
- [ ] 5.3 验证 Claude 进程中途异常退出时，卡片能以部分内容兜底结束
- [ ] 5.4 验证节流机制正常工作（不触发钉钉 API 限频）
