## 1. Claude Streaming Compatibility

- [x] 1.1 Update `callClaude` to append the CLI-required streaming flags when `onChunk` is present, including `--verbose`
- [x] 1.2 Verify the streaming event parser still works with the current CLI output after the argument change

## 2. DingTalk Card Response Validation

- [x] 2.1 Add explicit response types for AI card creation and streaming APIs in `src/types.ts`
- [x] 2.2 Update `createAICard` to validate HTTP status, top-level business result, delivery results, and required card identifiers before returning success
- [x] 2.3 Update `streamAICard` to validate its response using the same fail-closed approach and surface remote error details in logs

## 3. Card Flow Error Handling

- [x] 3.1 Update the card-mode path in `src/index.ts` so Claude streaming only starts after a valid card instance is created
- [x] 3.2 Prevent fake-success logs and `streamAICard` calls when card creation cannot support downstream streaming
- [x] 3.3 Implement the chosen fallback path for card creation or streaming startup failures and preserve actionable error messages for the user

## 4. Verification

- [x] 4.1 Reproduce the known Claude CLI startup error and confirm the new streaming invocation resolves it
- [x] 4.2 Reproduce a DingTalk card creation failure response and confirm the system now stops before logging `Created card` or using undefined identifiers
- [x] 4.3 Validate the happy path with a successful card creation and at least one streamed update
