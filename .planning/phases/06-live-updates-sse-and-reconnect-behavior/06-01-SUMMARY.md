---
phase: 06-live-updates-sse-and-reconnect-behavior
plan: "01"
subsystem: live-updates
tags: [sse, react-native-sse, reconnect, backoff, AppState, context, hooks]

# Dependency graph
requires:
  - phase: 04-build-typed-mobile-api-client
    provides: subscribeEvents() primitive in events.ts and useFarfieldEvents() hook
  - phase: 03-create-expo-app-skeleton
    provides: storage.ts settings persistence layer and ConnectionSettings model
provides:
  - Typed SSE transport contract with EventSourceConfig passthrough for controlled reconnect
  - useSseConnection() hook with explicit state machine, capped exponential backoff, AppState pause/resume
  - LiveUpdatesProvider + useLiveUpdates() context for app-wide SSE connection state
  - settings subscribeSettingsChanges() + saveSettingsAndNotify() for runtime reconnect on settings edits
affects:
  - 06-02 (query invalidation wiring — uses useLiveUpdates() and LiveUpdatesProvider context)
  - 07-collaboration-mode (live-update context for user input request events)
  - 05-mvp-ui-threads-and-chat (connection banner can be upgraded with SSE status in Phase 06-02)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - EventSourceConfig passthrough on subscribeEvents() to disable library retry and own backoff policy
    - InternalState ref pattern in hooks to avoid stale closures across retry timer callbacks
    - AppState.addEventListener for foreground/background connection pause with immediate resume
    - Capped exponential backoff with jitter (BACKOFF_BASE*2^attempt, BACKOFF_MAX=30s, JITTER=0.25)
    - Settings fan-out pattern via subscribeSettingsChanges() to decouple storage writes from SSE reconnect
    - LiveUpdatesProvider wraps QueryClientProvider children; exposes SseConnectionState + saveSettings

key-files:
  created:
    - farfield/apps/mobile/src/hooks/useSseConnection.ts
    - farfield/apps/mobile/src/live/LiveUpdatesProvider.tsx
  modified:
    - farfield/apps/mobile/src/api/events.ts
    - farfield/apps/mobile/src/hooks/useFarfieldEvents.ts
    - farfield/apps/mobile/src/settings/storage.ts
    - farfield/apps/mobile/app/_layout.tsx

key-decisions:
  - "pollingInterval:0 passed to EventSource to disable library-managed reconnect; hook owns retry/backoff"
  - "MAX_RETRIES=8 with BACKOFF_BASE=1s, BACKOFF_MAX=30s, JITTER=0.25 — bounded and observable"
  - "AppState pause sets status=paused without losing retry count; foreground resumes with connectRef.current()"
  - "saveSettingsAndNotify() wraps saveSettings() with listener fan-out; Settings screen should adopt it in Phase 06-02"
  - "LiveUpdatesProvider positioned inside QueryClientProvider so future query invalidation (06-02) can use both"
  - "No query invalidation in this plan; provider establishes transport foundation only"

patterns-established:
  - "SseStatus state machine: idle | connecting | connected | reconnecting | paused | error"
  - "InternalState ref separates React state (renders) from mutable timer/cleanup state (no stale closures)"
  - "connectRef.current pattern allows scheduleReconnect to invoke connect before it is declared"

requirements-completed: []

# Metrics
duration: 25min
completed: 2026-03-05
---

# Phase 06 Plan 01: SSE Reconnect Foundation Summary

**Typed SSE transport with explicit state machine, capped exponential backoff, AppState pause/resume, and app-wide LiveUpdatesProvider wired to settings-change notifications**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-03-04T23:24:13Z
- **Completed:** 2026-03-04T23:49:00Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Refactored `subscribeEvents()` to expose typed `FarfieldStatePayload`/`FarfieldHistoryPayload` shapes and `EventSourceConfig` passthrough, enabling callers to set `pollingInterval:0` to fully own reconnect policy
- Built `useSseConnection()` with an explicit 6-state lifecycle machine, capped exponential backoff (base 1s, max 30s, 25% jitter), AppState listener that pauses background reconnect churn and resumes immediately on foreground, and retry metadata (`retryCount`, `retryAt`) for observability
- Created `LiveUpdatesProvider` + `useLiveUpdates()` that loads settings async, subscribes to runtime settings changes via `subscribeSettingsChanges()`, drives `useSseConnection()`, and exposes connection state app-wide; wired into app root layout

## Task Commits

Each task was committed atomically:

1. **Task 1: Harden SSE transport contract** - `38e227b` (feat)
2. **Task 2: Add AppState-aware SSE hook with bounded backoff** - `ec5fa54` (feat)
3. **Task 3: Live-updates provider with settings-change awareness** - `07002b1` (feat)

## Files Created/Modified

- `farfield/apps/mobile/src/api/events.ts` - Added typed payload union, EventSourceConfig passthrough, SubscribeEventsOptions bag; backward-compatible 4th param
- `farfield/apps/mobile/src/hooks/useFarfieldEvents.ts` - Forward SubscribeEventsOptions to subscribeEvents(); stable optionsRef pattern
- `farfield/apps/mobile/src/hooks/useSseConnection.ts` - New: full lifecycle state machine with backoff, AppState, retry metadata, teardown
- `farfield/apps/mobile/src/settings/storage.ts` - Added subscribeSettingsChanges() + saveSettingsAndNotify() for runtime reconnect
- `farfield/apps/mobile/src/live/LiveUpdatesProvider.tsx` - New: async settings load, settings subscription, SSE context, useLiveUpdates() hook
- `farfield/apps/mobile/app/_layout.tsx` - Wrap app root with LiveUpdatesProvider inside QueryClientProvider

## Decisions Made

- `pollingInterval:0` is passed to the react-native-sse EventSource via `EventSourceConfig` to disable library-managed retry; `useSseConnection()` exclusively owns reconnect timing.
- Exponential backoff parameters: base 1 s, max 30 s, 25% jitter, MAX_RETRIES 8 — gives predictable ceiling and visible failure state without infinite retry loops.
- AppState pause does NOT reset `retryCount` — preserves failure context; a successful reconnect after returning to foreground resets it.
- `saveSettingsAndNotify()` is introduced alongside (not replacing) `saveSettings()` to avoid breaking existing callers; Settings screen should be migrated to the notify variant in Phase 06-02.
- LiveUpdatesProvider is placed inside QueryClientProvider so Phase 06-02 can call `queryClient.invalidateQueries()` from within the provider without needing a query client ref.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - typecheck, lint, and export all passed cleanly on first run.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `useLiveUpdates()` is available for any screen/hook that needs connection state
- `LiveUpdatesProvider` is live in the app root - SSE connection starts automatically once settings are saved
- Phase 06-02 can wire `onMessage` callback from `useSseConnection` to `queryClient.invalidateQueries()` using the LiveUpdatesContext value
- Settings screen should be updated to call `saveSettingsAndNotify()` instead of `saveSettings()` in Phase 06-02 so URL/token edits trigger SSE reconnect

---
*Phase: 06-live-updates-sse-and-reconnect-behavior*
*Completed: 2026-03-05*
