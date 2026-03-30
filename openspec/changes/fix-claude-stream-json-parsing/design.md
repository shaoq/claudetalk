## Context

ClaudeTalk 当前已经能在卡片模式下成功创建钉钉 AI 卡片，也能成功启动 `claude -p --output-format stream-json --verbose`。但从真实日志看，Claude CLI 的 stdout 以多种 NDJSON 事件混合输出，至少包含大量 `type: "system"` 的 hook / init / retry 事件。当前实现只把 `type === "assistant"` 且带 `delta` 的事件当成正文，因此真实正文没有被提取出来；随后在 close 阶段又使用 `accumulatedText || stdout.trim()` 作为兜底，最终把整段原始 NDJSON 输出误当成回复文本。

这个问题集中在 `src/index.ts` 的 `callClaude` 流式解析逻辑，以及 `src/types.ts` 对 Claude 流式事件的结构假设。钉钉卡片本身并不是这轮的阻塞点。

## Goals / Non-Goals

**Goals:**
- 让 `callClaude` 能从当前 CLI 的 `stream-json` 输出中正确提取正文文本增量
- 过滤掉系统事件和其他非正文事件，避免污染用户可见回复
- 防止流式模式在未解析到正文时把原始 NDJSON 当成最终回复返回
- 为“仅系统事件”“有正文事件”“最终 result 带结果”三种结束形态定义明确行为

**Non-Goals:**
- 不修改钉钉卡片创建 payload 或卡片更新接口
- 不重新设计卡片模板、占位文案或节流策略
- 不改变 Claude CLI 参数组合，只修正文提取与 fallback

## Decisions

### 1. 将正文提取从单字段匹配升级为事件归一化

**选择**: 在 `callClaude` 中增加统一的“正文提取器”，按事件类型和字段结构归一化提取文本，而不是只匹配 `assistant + delta`。

**替代方案**: 针对当前一条样本日志做硬编码匹配

**理由**: Claude `stream-json` 显然不是单一事件格式。归一化提取器更适合兼容当前和后续 CLI 输出变化，也便于把事件过滤和正文累积拆开处理。

### 2. 将系统事件与正文事件显式分流

**选择**: 只有被正文提取器识别为“用户可见文本增量”的事件才进入 `accumulatedText`；`system`、hook、初始化、重试等事件一律只参与调试日志，不参与回复文本。

**替代方案**: 继续让所有 JSON 行都进入统一 fallback

**理由**: 当前问题正是系统事件污染回复文本造成的。先在解析阶段把系统事件挡住，才能从根上避免错误输出。

### 3. 流式结束兜底只允许使用结构化正文，不允许回退到原始 NDJSON

**选择**: 流式模式结束时：
- 若 `result` 事件含有明确结果文本，则使用该结果
- 否则若已累积正文文本，则使用累积正文
- 否则返回空字符串或显式错误，而不是 `stdout.trim()`

**替代方案**: 继续沿用 `accumulatedText || stdout.trim()`

**理由**: 在流式模式下，`stdout` 是事件总线，不是用户回复文本。把它直接当最终输出属于语义错误，必须彻底移除。

## Risks / Trade-offs

- **[CLI 事件结构仍可能继续变化]** → 即便扩展了解析器，未来 CLI 仍可能新增其他正文事件形态。缓解：将提取逻辑集中封装，并保留原始 event 调试日志入口。
- **[过度过滤导致丢失正文]** → 如果正文事件字段仍识别不全，卡片可能继续空白。缓解：对最终 `result` 事件增加结构化兜底，并用真实 stdout 样本回归。
- **[空字符串结束影响用户体验]** → 如果既无增量也无最终结果，回复可能为空。缓解：让调用方在卡片/Markdown 层统一补“无可显示文本”的收敛文案，而不是输出原始事件 JSON。

## Migration Plan

1. 更新 OpenSpec 工件，明确流式正文提取与 fallback 约束
2. 调整 `src/types.ts` 的流式事件类型定义
3. 在 `src/index.ts` 中实现更稳健的流式事件正文提取器
4. 移除流式模式对 `stdout.trim()` 的原始 NDJSON fallback
5. 用真实 stdout 样本回归：确认系统事件不再进入回复，正文可持续更新

## Open Questions

- 当前 CLI 的真实正文事件是否主要出现在 `assistant` 以外的事件类型，例如 `content_block_delta` 或其他 subtype，需要在实现时通过真实 stdout 样本再补齐一次。
- 当最终 `result` 事件没有可用文本，但流式过程中也没有提取到正文时，是否应由 `callClaude` 直接抛错，还是由上层统一转成“空回复”提示。
