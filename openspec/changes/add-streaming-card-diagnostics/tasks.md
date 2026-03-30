## 1. Claude Stream Diagnostics

- [x] 1.1 Add diagnostic logs in `src/index.ts` for `content_block_delta` classification, including `delta.type` and extracted text length
- [x] 1.2 Add diagnostic logs for `onChunk(false)` so intermediate visible text updates are observable

## 2. Card Update Diagnostics

- [x] 2.1 Add diagnostic logs in the throttling path to show when intermediate updates are sent immediately versus deferred
- [x] 2.2 Add success logs in `src/dingtalk.ts#streamAICard` for both intermediate and final card update responses

## 3. Verification

- [ ] 3.1 Run a real short-reply card conversation and verify whether visible `text_delta` events appear in the logs
- [ ] 3.2 Verify whether at least one intermediate card update is actually sent before the final result
- [ ] 3.3 Use the new logs to classify the problem as parsing, update-calling, or pure UX/perception
