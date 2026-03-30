## 1. Payload Alignment

- [x] 1.1 Update `src/types.ts` so the AI card create request uses scene-specific open space model fields that match the official examples
- [x] 1.2 Refactor `src/dingtalk.ts#createAICard` to build private-chat payloads with `imRobotOpenSpaceModel` and `imRobotOpenDeliverModel`
- [x] 1.3 Refactor `src/dingtalk.ts#createAICard` to build group-chat payloads with `imGroupOpenSpaceModel` and `imGroupOpenDeliverModel`

## 2. Request Minimization

- [x] 2.1 Remove or stop sending top-level card create fields that are not part of the chosen official-compatible payload structure
- [x] 2.2 Reduce `cardData` to the smallest verified structure needed for successful card creation and document any template-dependent follow-up

## 3. Verification

- [ ] 3.1 Verify that a real private-chat card create request no longer returns `spaces of card is empty`
- [x] 3.2 Verify that a successful create response still returns the identifiers needed by the existing streaming update path
- [ ] 3.3 Verify whether the same payload strategy also succeeds in a group-chat scenario or identify any remaining group-specific gaps
