## ADDED Requirements

### Requirement: System uses a reference-compatible card creation contract
The system SHALL construct DingTalk AI card creation requests using the same runtime semantics as the verified reference connector for the same template class, including the correct private-chat target identity and the full create-time context required for the first rendered content to appear.

#### Scenario: Private-chat fixed-text experiment creates a visible first screen
- **WHEN** the system runs the fixed-text card experiment in a DingTalk private chat with a template whose visible field is `content`
- **THEN** the system SHALL send a create request whose target identity and payload structure are compatible with the reference connector contract
- **AND** the created card SHALL render the stage-one fixed text in DingTalk instead of showing a blank card

### Requirement: System preserves complete card runtime identifiers after creation
The system SHALL extract and retain all card identifiers and runtime metadata needed for subsequent updates and diagnostics, rather than relying only on `outTrackId`.

#### Scenario: Successful create returns a reusable card runtime context
- **WHEN** `createAICard` receives a successful DingTalk response
- **THEN** the system SHALL preserve `outTrackId`
- **AND** the system SHALL preserve any returned card instance identifier and other update-relevant metadata present in the response
- **AND** the card runtime context SHALL be passed to later update and finalize operations

### Requirement: System sends explicit update semantics for card field refresh
The system SHALL send AI card update requests with explicit card-data update semantics that are compatible with the DingTalk update contract and the reference connector behavior for the `content` field.

#### Scenario: Fixed-text experiment updates the same visible field
- **WHEN** the system updates the card created by the fixed-text experiment from the stage-one text to the stage-two text
- **THEN** the update request SHALL explicitly express that the `content` field is being refreshed
- **AND** DingTalk SHALL render the stage-two fixed text on the same card instance

### Requirement: System classifies blank-card results as protocol mismatch before blaming streaming
The system SHALL treat a blank stage-one card in the fixed-text experiment as evidence that card protocol alignment is incomplete, not as evidence of a Claude streaming failure.

#### Scenario: Create success but blank first screen
- **WHEN** the fixed-text experiment receives successful create/update API responses but the DingTalk card remains blank at stage one
- **THEN** the system SHALL classify the result as a create-time contract mismatch between runtime payload and template/rendering protocol
- **AND** the system SHALL require protocol-level investigation before further streaming-only changes are considered complete
