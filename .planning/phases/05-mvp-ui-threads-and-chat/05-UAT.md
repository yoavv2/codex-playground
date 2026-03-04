---
status: testing
phase: 05-mvp-ui-threads-and-chat
source: [05-01-SUMMARY.md, 05-02-SUMMARY.md]
started: 2026-03-04T18:52:20Z
updated: 2026-03-04T18:52:20Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 1
name: Browse, sort, and filter the thread list
expected: |
  With a configured, reachable Farfield server, the Threads tab shows real thread rows ordered by most recently updated first.
  Each row includes a source badge.
  Typing text that matches a thread title, id, or preview narrows the list immediately.
  Clearing the filter restores the full list.
awaiting: user response

## Tests

### 1. Browse, sort, and filter the thread list
expected: With a configured, reachable Farfield server, the Threads tab shows real thread rows ordered by most recently updated first. Each row includes a source badge. Typing text that matches a thread title, id, or preview narrows the list immediately. Clearing the filter restores the full list.
result: [pending]

### 2. Refresh the thread list without a full-screen reload
expected: Pulling down to refresh on the Threads tab keeps the current rows visible while only the refresh spinner runs; the screen does not fall back to a centered blank loading state.
result: [pending]

### 3. Open a thread in the chat-style detail layout
expected: Opening a thread shows a chat-style detail screen with readable turn bubbles, header metadata, and pull-to-refresh while keeping existing conversation content visible during refresh.
result: [pending]

### 4. Send a message from the composer
expected: Typing a non-empty message and tapping Send disables repeat sends while the request is in flight, clears the draft after success, and the conversation updates to include the new message.
result: [pending]

### 5. See useful connection banner feedback
expected: The Threads screen shows a compact status banner that clearly reflects current connectivity: connected on success, and useful configuration/auth/network guidance when the server URL or token is wrong.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0

## Gaps

None yet.
