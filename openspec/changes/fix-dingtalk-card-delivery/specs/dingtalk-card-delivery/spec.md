## ADDED Requirements

### Requirement: System resolves AI card delivery space by conversation scene
The system SHALL derive the AI card delivery space from the inbound DingTalk message scene instead of reusing the raw conversation identifier for every case.

#### Scenario: Private chat card delivery
- **WHEN** the bot receives a private chat message and card mode is enabled
- **THEN** the system SHALL build the card delivery space identifier from the sender staff ID using the private-chat robot card scene

#### Scenario: Group chat card delivery
- **WHEN** the bot receives a group chat message and card mode is enabled
- **THEN** the system SHALL build the card delivery space identifier from the group conversation ID using the group card scene

### Requirement: System sends scene-matched AI card creation models
The system SHALL send the AI card creation request with the delivery model and open space model that match the resolved DingTalk conversation scene.

#### Scenario: Private chat request payload
- **WHEN** the system creates an AI card for a private chat
- **THEN** the request SHALL include the private-chat open space model and private-chat deliver model alongside the resolved `openSpaceId`

#### Scenario: Group chat request payload
- **WHEN** the system creates an AI card for a group chat
- **THEN** the request SHALL include the group open space model and group deliver model alongside the resolved `openSpaceId`

### Requirement: System validates AI card create responses using standard success semantics
The system SHALL treat an AI card create request as successful only when the HTTP response is successful and the response body does not contain a DingTalk business error.

#### Scenario: Successful card creation
- **WHEN** DingTalk returns a successful HTTP response and no business error code
- **THEN** the system SHALL return the created card identifiers without raising an error

#### Scenario: Failed card creation
- **WHEN** DingTalk returns a non-success HTTP status or a business error response
- **THEN** the system SHALL raise an error containing the remote error code or message for diagnosis

### Requirement: System validates required private-chat card context
The system SHALL reject private-chat card creation when the inbound callback does not provide the staff identifier required to construct the private delivery space.

#### Scenario: Missing sender staff ID
- **WHEN** card mode is enabled for a private chat message but `senderStaffId` is absent
- **THEN** the system SHALL stop card creation and surface a descriptive error instead of sending an invalid DingTalk request
