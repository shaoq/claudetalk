## 1. Reply Flow Adjustment

- [x] 1.1 删除 `src/index.ts` 中 markdown 模式发送“👍 收到，正在处理...”确认消息的逻辑
- [x] 1.2 删除 `src/index.ts` 中 card 模式在创建 AI 卡片前发送同类确认消息的逻辑
- [ ] 1.3 验证删除后 markdown 模式仍能正常返回最终回复，card 模式仍能正常创建并更新卡片

## 2. Spec And Documentation Alignment

- [x] 2.1 更新 `openspec/changes/streaming-card-output/proposal.md`，去掉对静态“收到，正在处理...”提示的依赖性描述
- [x] 2.2 更新 `openspec/changes/streaming-card-output/design.md`，移除“卡片模式先发收到确认”的流程定义
- [x] 2.3 更新 `openspec/changes/streaming-card-output/tasks.md`，删除或改写要求先发送确认消息的任务项
