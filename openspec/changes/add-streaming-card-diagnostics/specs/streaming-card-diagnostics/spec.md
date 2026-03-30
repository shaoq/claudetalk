## ADDED Requirements

### Requirement: System logs content block delta classification for streaming diagnostics
The system SHALL emit diagnostic logs that distinguish visible `text_delta` events from non-visible delta variants during Claude stream parsing.

#### Scenario: Visible text delta
- **WHEN** the parsed Claude event is `content_block_delta` and `delta.type` is `text_delta`
- **THEN** the system SHALL log that a visible text delta was observed, including a timestamp and the extracted text length

#### Scenario: Non-visible delta
- **WHEN** the parsed Claude event is `content_block_delta` and `delta.type` is not `text_delta`
- **THEN** the system SHALL log the delta type without appending it to user-visible card content

### Requirement: System logs middle-stage card update attempts
The system SHALL emit diagnostic logs when intermediate card update paths are triggered.

#### Scenario: onChunk false path
- **WHEN** Claude stream parsing produces a non-final visible text update
- **THEN** the system SHALL log that `onChunk(false)` was triggered, including the current accumulated text length

#### Scenario: Throttled update dispatch
- **WHEN** the throttling logic dispatches or schedules an intermediate card update
- **THEN** the system SHALL log whether the update was sent immediately or deferred, along with the pending text length

### Requirement: System logs successful DingTalk card update responses
The system SHALL emit a success log when DingTalk accepts an intermediate or final card update request.

#### Scenario: Intermediate card update success
- **WHEN** `streamAICard()` returns a successful HTTP and business response for a non-final update
- **THEN** the system SHALL log the update success with the outTrackId and text length

#### Scenario: Final card update success
- **WHEN** `streamAICard()` returns a successful HTTP and business response for the final update
- **THEN** the system SHALL log the finalize success with the outTrackId and text length
