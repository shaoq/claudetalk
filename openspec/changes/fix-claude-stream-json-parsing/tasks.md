## 1. Stream Event Parsing

- [x] 1.1 Extend `src/types.ts` to model the Claude stream-json event shapes needed for text extraction
- [x] 1.2 Refactor `callClaude` in `src/index.ts` to normalize supported text-bearing events instead of only matching `assistant + delta`
- [x] 1.3 Ensure system, hook, init, and retry events are excluded from accumulated reply text

## 2. Streaming Fallback Safety

- [x] 2.1 Remove the streaming-mode fallback that returns raw `stdout.trim()` as the final reply
- [x] 2.2 Define the finalization behavior when only a result event carries usable text, and when no usable text is present at all

## 3. Verification

- [x] 3.1 Reproduce the current bad case and confirm raw NDJSON no longer appears in the final reply text
- [x] 3.2 Verify that a real card-mode conversation now triggers visible card content updates instead of staying blank
- [x] 3.3 Verify that streaming still completes correctly when the final result event is the only source of assistant text
