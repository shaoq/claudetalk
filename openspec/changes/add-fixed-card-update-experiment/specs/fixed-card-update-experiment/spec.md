## ADDED Requirements

### Requirement: System can run a fixed-text card creation and update experiment
The system SHALL support an experiment path that creates an AI card with a fixed initial text and then updates the same card with a fixed follow-up text without invoking Claude.

#### Scenario: Two-stage fixed card experiment
- **WHEN** the experiment is triggered
- **THEN** the system SHALL create an AI card with a fixed stage-one text, wait a controlled interval, and update the same card with a fixed stage-two text

### Requirement: System logs fixed-card experiment stages
The system SHALL emit logs for each experiment stage so the UI result can be compared with the actual calls.

#### Scenario: Stage one create log
- **WHEN** the experiment creates the card
- **THEN** the system SHALL log the outTrackId, stage name, and fixed text used for creation

#### Scenario: Stage two update log
- **WHEN** the experiment updates the existing card
- **THEN** the system SHALL log the outTrackId, stage name, and fixed text used for the update

### Requirement: System preserves experiment results for template-contract diagnosis
The system SHALL make it possible to distinguish template display issues from Claude streaming issues based on the experiment outcome.

#### Scenario: Create visible, update invisible
- **WHEN** the experiment shows the stage-one text in DingTalk but not the stage-two text
- **THEN** the system SHALL treat that outcome as evidence that card creation displays correctly but card update display semantics still need investigation

#### Scenario: Both stages invisible
- **WHEN** the experiment shows neither the stage-one text nor the stage-two text in DingTalk despite successful API calls
- **THEN** the system SHALL treat that outcome as evidence of a template binding or card field contract issue
