## 1. Stream Event Normalization

- [x] 1.1 Extend `src/types.ts` to model top-level `stream_event` wrappers and their inner event payloads
- [x] 1.2 Add a normalization step in `src/index.ts` so `callClaude` unwraps `stream_event.event` before applying event filters and text extraction

## 2. Text Delta Filtering

- [x] 2.1 Update the incremental text extractor to accept only `content_block_delta` events whose `delta.type` is `text_delta`
- [x] 2.2 Explicitly ignore `thinking_delta` and other non-user-visible delta variants so they never enter `accumulatedText`
- [x] 2.3 Keep assistant snapshot handling as a replacement-style consistency layer rather than an append-only path

## 3. Verification

- [x] 3.1 Verify with a real Claude stdout sample that `stream_event` is no longer logged as unhandled during normal text generation
- [x] 3.2 Verify that a real card-mode conversation now produces intermediate card updates before the final result arrives
- [x] 3.3 Verify that final result handling still works when wrapped stream events, assistant snapshot events, and top-level result events all appear in the same run
