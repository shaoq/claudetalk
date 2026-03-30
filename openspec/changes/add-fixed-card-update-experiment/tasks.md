## 1. Experiment Entry

- [x] 1.1 Add a dedicated trigger for the fixed card update experiment that does not invoke Claude
- [x] 1.2 Ensure the trigger is clearly marked as an experiment/diagnostic path

## 2. Fixed Card Flow

- [x] 2.1 Implement stage-one card creation with a fixed initial text
- [x] 2.2 Implement a delayed stage-two update on the same card with a fixed follow-up text
- [x] 2.3 Add logs for each experiment stage including outTrackId and stage text

## 3. Verification

- [ ] 3.1 Run the experiment in a real DingTalk private chat and verify whether the stage-one text is visible
- [ ] 3.2 Verify whether the same card updates from stage-one text to stage-two text
- [ ] 3.3 Use the experiment result to classify the issue as template binding, update semantics, or downstream UX
