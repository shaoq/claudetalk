## ADDED Requirements

### Requirement: System extracts user-visible text from Claude stream-json output
The system SHALL parse Claude `stream-json` output and accumulate only user-visible assistant text from supported event structures.

#### Scenario: Assistant text arrives as incremental stream events
- **WHEN** Claude emits supported stream events containing assistant text deltas
- **THEN** the system SHALL extract those deltas, append them to the accumulated reply text, and forward the accumulated text to downstream streaming consumers

#### Scenario: Assistant text arrives only in the final result event
- **WHEN** Claude emits no supported text delta events but the final `result` event contains reply text
- **THEN** the system SHALL use the final result text as the reply content

### Requirement: System filters non-user-visible Claude stream events
The system SHALL ignore Claude stream events that are not user-visible assistant reply text.

#### Scenario: System hook event
- **WHEN** Claude emits a `system` or hook-related event such as startup, resume, retry, or init
- **THEN** the system SHALL NOT append that event payload to the accumulated reply text

#### Scenario: Unsupported non-text event
- **WHEN** Claude emits a valid JSON event that does not contain supported user-visible assistant text
- **THEN** the system SHALL ignore it for reply generation and continue parsing subsequent events

### Requirement: System does not treat raw NDJSON output as final reply text
The system SHALL NOT use raw `stdout` NDJSON text as the final assistant reply in streaming mode.

#### Scenario: No parsed text and no usable final result
- **WHEN** streaming mode finishes without any extracted assistant text and without a usable final result text
- **THEN** the system SHALL return an empty or explicitly handled reply state instead of returning the raw NDJSON event stream

#### Scenario: Parsed text exists before process close
- **WHEN** streaming mode has already extracted assistant text before process close
- **THEN** the system SHALL finalize using the extracted text rather than any raw `stdout` fallback
