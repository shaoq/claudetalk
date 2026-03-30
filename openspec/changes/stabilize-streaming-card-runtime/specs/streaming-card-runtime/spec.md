## ADDED Requirements

### Requirement: System starts Claude streaming mode with CLI-compatible arguments
The system SHALL invoke Claude CLI with the argument set required by the installed CLI version whenever card mode requests streaming output.

#### Scenario: Card mode uses streaming CLI output
- **WHEN** card mode is enabled and the reply flow passes an `onChunk` callback to `callClaude`
- **THEN** the system SHALL invoke `claude -p` with `--output-format stream-json` and any additional CLI flags required for that mode, including `--verbose`

#### Scenario: Non-streaming mode remains unchanged
- **WHEN** the reply flow does not request streaming output
- **THEN** the system SHALL continue using the non-streaming Claude invocation path and SHALL NOT require streaming-only flags

### Requirement: System rejects AI card creation responses that only succeed at HTTP level
The system SHALL treat AI card creation as failed unless the DingTalk response indicates both transport success and actual card delivery success.

#### Scenario: HTTP success but delivery failure
- **WHEN** `createAndDeliver` returns HTTP success but the response body contains failed delivery results
- **THEN** the system SHALL raise an error using the remote delivery error message and SHALL NOT create an `AICardInstance`

#### Scenario: Missing card identifier in create response
- **WHEN** `createAndDeliver` returns a response without the identifier required for subsequent streaming updates
- **THEN** the system SHALL raise an error instead of returning a partial card object

#### Scenario: Successful card creation
- **WHEN** `createAndDeliver` returns HTTP success, the response body reports at least one successful delivery result, and the required card identifier is present
- **THEN** the system SHALL return a populated `AICardInstance`

### Requirement: System only starts card streaming after valid card creation
The system SHALL enter the DingTalk card streaming update loop only after AI card creation has completed successfully with a valid card instance.

#### Scenario: Card creation succeeds
- **WHEN** `createAICard` returns a valid card instance
- **THEN** the system SHALL begin Claude streaming and forward incremental content to `streamAICard`

#### Scenario: Card creation fails
- **WHEN** `createAICard` throws an error or returns no valid card identifier
- **THEN** the system SHALL skip `streamAICard` calls and SHALL follow the configured fallback or error response path

### Requirement: System surfaces runtime failures without leaving fake-success card state
The system SHALL make runtime failures visible and SHALL NOT log or expose card creation as successful when subsequent required state is missing.

#### Scenario: Create response cannot support streaming
- **WHEN** card creation returns a response that cannot support `card/streaming`
- **THEN** the system SHALL log the failure context and stop the card path before any `"Created card"` success log is emitted

#### Scenario: Claude streaming startup fails
- **WHEN** Claude CLI exits before emitting usable streaming content
- **THEN** the system SHALL surface the CLI error and SHALL finalize the card path through the defined failure handling instead of continuing as though streaming had started
