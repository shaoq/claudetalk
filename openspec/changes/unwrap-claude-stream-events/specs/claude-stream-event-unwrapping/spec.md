## ADDED Requirements

### Requirement: System unwraps Claude stream_event wrapper events before text parsing
The system SHALL inspect top-level Claude `stream-json` events and unwrap `stream_event.event` before applying text extraction rules.

#### Scenario: Wrapped content block delta
- **WHEN** Claude emits a top-level event with `type: "stream_event"` and an inner `event`
- **THEN** the system SHALL parse the inner `event` as the actual event for text extraction and filtering

#### Scenario: Non-wrapped event
- **WHEN** Claude emits a top-level event that is not `stream_event`
- **THEN** the system SHALL continue parsing that top-level event directly

### Requirement: System only treats text_delta as user-visible incremental text
The system SHALL treat `content_block_delta` events as user-visible text only when the inner delta type is `text_delta`.

#### Scenario: Visible assistant text delta
- **WHEN** the actual parsed event is `content_block_delta` and `delta.type` is `text_delta`
- **THEN** the system SHALL append `delta.text` to the accumulated reply text and forward the updated text to downstream streaming consumers

#### Scenario: Thinking delta
- **WHEN** the actual parsed event is `content_block_delta` and `delta.type` is `thinking_delta`
- **THEN** the system SHALL NOT append that delta to the accumulated reply text

### Requirement: System preserves assistant snapshot and final result as consistency layers
The system SHALL continue to support assistant snapshot events and final result events after `stream_event` unwrapping is added.

#### Scenario: Assistant snapshot arrives after incremental deltas
- **WHEN** Claude emits a top-level `assistant` event with a text content snapshot
- **THEN** the system SHALL use that snapshot to refresh the accumulated reply text without duplicating previously appended deltas

#### Scenario: Final result arrives after wrapped stream events
- **WHEN** Claude emits a top-level `result` event after wrapped stream events
- **THEN** the system SHALL finalize using the result text if present, otherwise using the accumulated reply text
