---
status: testing
phase: 08-ux-polish-and-platform-readiness
source: [08-01-SUMMARY.md, 08-02-SUMMARY.md]
started: 2026-03-05T09:00:00Z
updated: 2026-03-05T09:00:00Z
---

## Current Test

number: 1
name: Thread detail markdown and code rendering
expected: |
  Conversation turns render markdown structures (headings, lists, inline code, fenced code)
  without layout breakage on iOS and Android. Copy message and copy code actions work.
awaiting: user response

## Tests

### 1. Thread detail markdown and code rendering
expected: Open a thread containing markdown and fenced code blocks. Rendering is readable, scroll behavior is stable, and tapping copy actions copies expected text.
result: [pending]

### 2. Approval decision flow from mobile
expected: For a thread with pending approvals, approve and deny actions are available and each decision shows pending state, then refreshes to resolved state without crashing.
result: [pending]

### 3. Request-user-input flow regression
expected: Pending request_user_input cards still render and submit successfully after Phase 08 changes.
result: [pending]

### 4. Composer UX regression
expected: Sending a message remains responsive, duplicate taps are prevented while pending, and failures show recoverable inline errors.
result: [pending]

### 5. Local/Tailscale profile persistence
expected: Save different values for Local and Tailscale profiles, switch profiles, restart app, and confirm values persist per profile.
result: [pending]

### 6. Connection diagnostics by active profile
expected: Connection tab shows active profile label and health check targets the selected profile settings.
result: [pending]

### 7. iOS platform smoke pass
expected: Core browse/read/send/approve/profile flows are stable on iOS simulator/device with no critical crashes.
result: [pending]

### 8. Android platform smoke pass
expected: Core browse/read/send/approve/profile flows are stable on Android emulator/device with no critical crashes.
result: [pending]

## Summary

total: 8
passed: 0
issues: 0
pending: 8
skipped: 0

## Gaps

- none recorded yet; update after manual run
