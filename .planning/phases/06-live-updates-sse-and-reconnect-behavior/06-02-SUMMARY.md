---
phase: 06-live-updates-sse-and-reconnect-behavior
plan: "02"
subsystem: live-updates
tags: [sse, tanstack-query, query-invalidation, debounce, event-routing, react-context]

# Dependency graph
requires:
  - phase: 06-live-updates-sse-and-reconnect-behavior
    plan: "01"
    provides: useSseConnection() with onMessage handler, LiveUpdatesProvider context, subscribeSettingsChanges/saveSettingsAndNotify
  - phase: 04-build-typed-mobile-api-client
    provides: queryKeys factory and TanStack Query hook infrastructure
provides:
  - Pure event-routing module classifying SSE payloads into SyncIntents for targeted invalidation
  - LiveUpdatesProvider with debounced per-domain query invalidation wired to onMessage
  - useLiveUpdates.ts stable re-export hook from dedicated module path
  - Settings screen using saveSettingsAndNotify for SSE-reconnect-triggering saves
  - Threads tab connection banner augmented with live SSE status variants
affects:
  - 06-03 (reconnect behavior refinements build on live-update pipeline)
  - 07-collaboration-mode (can read useLiveUpdates() for connection state)
  - 05-mvp-ui-threads-and-chat (threads banner now shows live-connected/reconnecting/error)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Pure event classifier (routeEvent) with discriminated union SyncIntent — no side effects, fully testable
    - Per-domain debounce timer Maps coalesce rapid IPC frame bursts into single invalidation
    - useQueryClient() inside provider — safe because LiveUpdatesProvider is inside QueryClientProvider
    - queryClientRef.current pattern keeps queryClient stable in callbacks without lint warnings
    - Stable re-export module (useLiveUpdates.ts) for clean import paths separate from provider file

key-files:
  created:
    - farfield/apps/mobile/src/live/event-routing.ts
    - farfield/apps/mobile/src/live/useLiveUpdates.ts
  modified:
    - farfield/apps/mobile/src/live/LiveUpdatesProvider.tsx
    - farfield/apps/mobile/src/settings/index.ts
    - farfield/apps/mobile/app/(tabs)/settings.tsx
    - farfield/apps/mobile/app/(tabs)/threads.tsx

key-decisions:
  - "Per-domain debounce windows: thread-list 800ms, thread-detail 400ms, approvals 300ms, collab-mode 800ms"
  - "Per-threadId Map of timers for detail/approvals so burst on one thread does not suppress updates on another"
  - "Only action stage=success triggers invalidation; attempt/error stages are no-ops to avoid premature refetch"
  - "routeEvent() is pure with no React or query dependencies — can be unit-tested in isolation"
  - "SSE status layered on top of REST errors in deriveConnectionStatus: REST errors always surface first"
  - "useLiveUpdates.ts is a thin re-export module so screens import from a stable dedicated path"
  - "saveSettingsAndNotify now exported from settings/index.ts; Settings screen migrated to notify variant"

patterns-established:
  - "SyncIntent discriminated union: no-op | thread-list-changed | thread-detail-changed | thread-list-and-detail-changed | approvals-changed | collaboration-mode-changed"
  - "IPC history frames route to thread-detail-changed (debounced) — high-frequency events coalesced automatically"
  - "Action events only produce intents on stage=success to avoid refetch-on-attempt noise"

requirements-completed: []

# Metrics
duration: 30min
completed: 2026-03-05
---

# Phase 06 Plan 02: Query Invalidation Wiring Summary

**Debounced TanStack Query invalidation from SSE events via pure event classifier, per-domain timer coalescing, and live connection status in Threads tab banner**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-03-04T23:32:26Z
- **Completed:** 2026-03-05T00:02:00Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Built `routeEvent()` pure classifier that maps every Farfield `/events` payload shape (state broadcasts, IPC history frames, app action events) to a typed `SyncIntent` without screen-specific logic
- Extended `LiveUpdatesProvider` with `useInvalidationHandler()` — per-domain debounce timer Maps that coalesce rapid IPC frame bursts into single `queryClient.invalidateQueries()` calls; REST remains source of truth
- Added `useLiveUpdates.ts` stable re-export, migrated Settings screen to `saveSettingsAndNotify()`, and augmented Threads tab connection banner with SSE status variants (live-connected / live-reconnecting / live-error)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create deterministic event-routing utilities** - `e981503` (feat)
2. **Task 2: Implement debounced query invalidation in provider** - `ca6909e` (feat)
3. **Task 3: Expose stable consumer hook and mount provider at root** - `c2c55ac` (feat)

## Files Created/Modified

- `farfield/apps/mobile/src/live/event-routing.ts` - New: pure `routeEvent()` classifier, SyncIntent union types, action/IPC/state routing logic
- `farfield/apps/mobile/src/live/useLiveUpdates.ts` - New: stable re-export hook from dedicated module path
- `farfield/apps/mobile/src/live/LiveUpdatesProvider.tsx` - Extended: added `useInvalidationHandler()` with per-domain debounce timers and `useQueryClient()` invalidation; wired `onMessage` to `useSseConnection`
- `farfield/apps/mobile/src/settings/index.ts` - Added `saveSettingsAndNotify` and `subscribeSettingsChanges` exports
- `farfield/apps/mobile/app/(tabs)/settings.tsx` - Migrated `saveSettings()` → `saveSettingsAndNotify()` for SSE-reconnect-triggering saves
- `farfield/apps/mobile/app/(tabs)/threads.tsx` - Added `useLiveUpdates()` import; augmented `deriveConnectionStatus()` and `connectionBannerProps()` with SSE status variants

## Decisions Made

- Per-domain debounce windows chosen by urgency: approval prompts (300ms) are most time-sensitive, thread detail (400ms), thread list and collab mode (800ms) tolerate more latency.
- Per-threadId `Map<string | null, setTimeout>` rather than a single timer per domain — prevents a burst on one active thread from suppressing updates on an unrelated thread open in the background.
- `action stage !== "success"` produces `no-op` — attempt and error stages are informational and should not trigger premature refetches.
- `routeEvent()` kept as a pure function with no React/query imports so it can be unit-tested without provider setup.
- REST errors always surface first in `deriveConnectionStatus()` — an unauthorized error is more actionable than an SSE reconnecting state.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added saveSettingsAndNotify and subscribeSettingsChanges to settings index**
- **Found during:** Task 3 (Settings screen migration)
- **Issue:** `settings/index.ts` only exported `saveSettings`, not `saveSettingsAndNotify` or `subscribeSettingsChanges`, so the Settings screen import would have failed
- **Fix:** Added both exports to `src/settings/index.ts`
- **Files modified:** `farfield/apps/mobile/src/settings/index.ts`
- **Verification:** TypeScript typecheck passes; import resolves correctly
- **Committed in:** `c2c55ac` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 — missing critical export)
**Impact on plan:** Required for Settings screen migration to compile. No scope creep.

## Issues Encountered

None — typecheck, lint, and expo export all passed cleanly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `routeEvent()` is available for any future phase needing SSE payload classification
- `useLiveUpdates()` exposes status/retryCount/retryAt/lastError from the single shared SSE pipeline
- Threads tab connection banner now reflects live SSE health — no screen-level polling needed
- Phase 06-03 can build on this foundation for any remaining reconnect behavior refinements
- Phase 07 can import `useLiveUpdates()` for user-input-request event handling without new infrastructure

---
*Phase: 06-live-updates-sse-and-reconnect-behavior*
*Completed: 2026-03-05*
