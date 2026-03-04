---
status: testing
phase: 04-build-typed-mobile-api-client
source: 04-01-SUMMARY.md, 04-02-SUMMARY.md, 04-03-SUMMARY.md
started: 2026-03-04T19:00:00Z
updated: 2026-03-04T19:00:00Z
---

## Current Test

number: 1
name: App Builds and Starts Without Errors
expected: |
  Run `bun run --filter @farfield/mobile typecheck` — exits 0 with no type errors.
  Run `bun run --filter @farfield/mobile lint` — exits 0.
  Metro bundler starts without resolution errors for @farfield/protocol imports.
awaiting: user response

## Tests

### 1. App Builds and Starts Without Errors
expected: Run `bun run --filter @farfield/mobile typecheck` — exits 0 with no type errors. Run `bun run --filter @farfield/mobile lint` — exits 0. Metro bundler starts without resolution errors for @farfield/protocol imports.
result: [pending]

### 2. Threads Tab Shows Live Thread Data
expected: With a running Farfield server and valid connection settings, the Threads tab fetches and displays real thread data from the server. Shows loading state while fetching. If no threads exist, shows an empty state. If the server is unreachable, shows an error state. Pull-to-refresh triggers a re-fetch.
result: [pending]

### 3. Thread Detail Renders Conversation Turns
expected: Tapping a thread in the Threads tab navigates to the Thread Detail screen. The screen displays conversation turns (messages) from the thread. If the thread has pending approvals, they appear as read-only approval cards. The screen is read-only — no composer or action buttons yet.
result: [pending]

### 4. Authentication Header Sent on API Calls
expected: When an auth token is configured in Settings, all API requests to the Farfield server include an `Authorization: Bearer <token>` header. If the token is wrong or missing when the server requires auth, the app shows an appropriate error (not a crash).
result: [pending]

### 5. Typed Error Handling for API Failures
expected: When the server is unreachable, the app shows an error state (not a crash or unhandled exception). When the server returns a non-2xx response, the error is surfaced to the user. When settings have no server URL configured, navigating to Threads shows an appropriate error or empty state rather than crashing.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0

## Gaps

[none yet]
