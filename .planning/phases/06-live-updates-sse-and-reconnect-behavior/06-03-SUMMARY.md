---
phase: 06-live-updates-sse-and-reconnect-behavior
plan: "03"
subsystem: live-updates
tags: [sse, react-native, connection-status, ui, threads, expo]

# Dependency graph
requires:
  - phase: 06-live-updates-sse-and-reconnect-behavior
    plan: "01"
    provides: useSseConnection() with SseStatus/SseConnectionState types including retryAt
  - phase: 06-live-updates-sse-and-reconnect-behavior
    plan: "02"
    provides: useLiveUpdates() stable re-export hook with connection state; Threads banner SSE variants
provides:
  - Threads tab banner with live countdown during reconnecting (retryAt-driven, ticks every second)
  - Thread-detail live-sync chip (connected/reconnecting/disconnected/paused/connecting variants)
  - Connection tab live-transport row using consistent vocabulary across all three surfaces
  - Phase 06 closed out with SUMMARY.md, STATE.md, and ROADMAP.md updates
affects:
  - 07-collaboration-mode (can read useLiveUpdates() — consistent status vocabulary already established)
  - 08-ux-polish-and-platform-readiness (live-status UI patterns established here)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - setInterval countdown in banner component — clears when status leaves reconnecting
    - Null render pattern for idle/unconfigured state — components return null, no UI clutter
    - Consistent SSE status vocabulary (color + label) across Threads banner, thread-detail chip, Connection tab row

key-files:
  created:
    - .planning/phases/06-live-updates-sse-and-reconnect-behavior/06-03-SUMMARY.md
  modified:
    - farfield/apps/mobile/app/(tabs)/threads.tsx
    - farfield/apps/mobile/app/thread/[threadId].tsx
    - farfield/apps/mobile/app/(tabs)/index.tsx
    - .planning/STATE.md
    - .planning/ROADMAP.md

key-decisions:
  - "Retry countdown rendered in threads banner: retryAt drives seconds-until-retry label, interval clears on non-reconnecting status"
  - "Thread-detail uses chip (compact inline) not banner (full-width) to preserve chat layout density"
  - "Connection tab live row uses full-width pill with richer label copy than chip (context: troubleshooting screen)"
  - "idle state renders null on all three surfaces — unconfigured setup shows no misleading indicators"

patterns-established:
  - "ConnectionBanner / LiveSyncChip / LiveTransportRow: same SseStatus input, consistent color vocabulary (#34C759 live, #FF9500 reconnecting/error, #8E8E93 paused/connecting, #FF3B30 terminal error)"
  - "Pull to refresh always mentioned in actionable fallback copy when SSE is not connected"

requirements-completed: []

# Metrics
duration: 2min
completed: 2026-03-05
---

# Phase 06 Plan 03: UI Live Status Summary

**Live transport status surfaced across Threads, Thread Detail, and Connection screens with retry countdown and consistent SSE vocabulary, completing Phase 06**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-04T23:40:02Z
- **Completed:** 2026-03-04T23:42:24Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Enhanced Threads tab connection banner with a live retry countdown: when SSE is reconnecting, the banner label shows "Reconnecting in Ns" driven by `retryAt`, updating every second via `setInterval`
- Added `LiveSyncChip` to thread detail header card — shows SSE connection health inline without disrupting the chat layout; "pull to refresh" copy provides actionable fallback during disconnect
- Added `LiveTransportRow` to Connection tab with the same SseStatus color vocabulary as the Threads banner, giving the setup/troubleshooting screen runtime SSE health visibility

## Task Commits

Each task was committed atomically:

1. **Task 1: Threads banner with retry countdown** - `e66ebed` (feat)
2. **Task 2: Thread-detail chip and Connection tab row** - `6df4827` (feat)
3. **Task 3: Phase 06 SUMMARY and planning handoff** - *(this commit)*

## Files Created/Modified

- `farfield/apps/mobile/app/(tabs)/threads.tsx` - Enhanced `ConnectionBanner` with `retryAt` prop and per-second countdown interval; added `useEffect` import
- `farfield/apps/mobile/app/thread/[threadId].tsx` - Added `useLiveUpdates()` import, `LiveSyncChip` component with `liveSyncChipProps()`, chip rendered inside thread header card; styles added
- `farfield/apps/mobile/app/(tabs)/index.tsx` - Added `useLiveUpdates()` import, `LiveTransportRow` component with `liveTransportProps()`, rendered below Test Connection button; styles added

## Decisions Made

- Retry countdown ticks using a `setInterval` inside `ConnectionBanner` — starts only during `live-reconnecting` with a non-null `retryAt`, clears on other statuses.
- Thread-detail uses a compact chip rather than a full-width banner to keep the chat surface uncluttered; the chip still carries actionable copy ("pull to refresh").
- Connection tab uses a wider row with more descriptive labels (e.g. "Live updates: paused (app backgrounded)") since it is a troubleshooting screen where diagnostic verbosity is appropriate.
- `idle` state renders `null` on all three surfaces so unconfigured sessions see no confusing placeholders.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None — typecheck, lint, and Metro all passed cleanly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 06 is complete: SSE reconnect foundation (06-01), query invalidation wiring (06-02), and UI status surfaces (06-03) all shipped
- `useLiveUpdates()` is the single stable import path for any Phase 07+ screen needing SSE connection state
- Connection status vocabulary (colors + labels) is established and should be reused or extended in Phase 08 UX polish
- Phase 07 (Collaboration Mode + User Input Requests) can begin without any blocking Phase 06 work

## Self-Check: PASSED

- `06-03-SUMMARY.md` exists
- Commit `e66ebed` (Task 1) confirmed in git log
- Commit `6df4827` (Task 2) confirmed in git log
- typecheck: exit 0
- lint: exit 0

---
*Phase: 06-live-updates-sse-and-reconnect-behavior*
*Completed: 2026-03-05*
