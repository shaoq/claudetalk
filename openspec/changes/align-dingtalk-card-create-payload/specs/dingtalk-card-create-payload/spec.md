## ADDED Requirements

### Requirement: System sends official-compatible createAndDeliver payloads for private chats
The system SHALL construct the DingTalk AI card `createAndDeliver` request for private chats using the official scene-specific payload structure.

#### Scenario: Private chat card creation
- **WHEN** the bot receives a private chat message and creates an AI card
- **THEN** the request SHALL include `openSpaceId` for the `IM_ROBOT` scene, `imRobotOpenSpaceModel`, `imRobotOpenDeliverModel`, and the card data fields required by the official-compatible payload

### Requirement: System sends official-compatible createAndDeliver payloads for group chats
The system SHALL construct the DingTalk AI card `createAndDeliver` request for group chats using the official scene-specific payload structure.

#### Scenario: Group chat card creation
- **WHEN** the bot receives a group chat message and creates an AI card
- **THEN** the request SHALL include `openSpaceId` for the `IM_GROUP` scene, `imGroupOpenSpaceModel`, `imGroupOpenDeliverModel`, and the card data fields required by the official-compatible payload

### Requirement: System avoids unverified card creation fields that can break space resolution
The system SHALL NOT send card creation fields that are not part of the selected official-compatible payload structure for the current scene.

#### Scenario: Unsupported top-level space field
- **WHEN** the create request is built for DingTalk AI card delivery
- **THEN** the system SHALL omit unsupported or unverified top-level space model fields that are not used by the selected official-compatible scene payload

#### Scenario: Minimized card data shape
- **WHEN** the create request is built for DingTalk AI card delivery
- **THEN** the system SHALL use the minimized verified card data shape needed to create the card successfully before adding optional fields back
