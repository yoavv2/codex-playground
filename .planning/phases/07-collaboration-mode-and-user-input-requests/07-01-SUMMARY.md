---
phase: 07-collaboration-mode-and-user-input-requests
plan: "01"
subsystem: api
tags: [live-state, request-user-input, tanstack-query, zod, expo]

# Dependency graph
requires:
  - phase: 06-live-updates-sse-and-reconnect-behavior
    plan: "02"
    provides: query invalidation architecture and shared query key conventions
  - phase: 04-build-typed-mobile-api-client
    provides: fetchJson transport and endpoint module structure
provides:
  - Typed `GET /api/threads/:id/live-state` mobile API module
  - Pending request_user_input extraction helper from conversation state
  - New query keys for live-state and collaboration mode list queries
  - Typed `POST /api/threads/:id/user-input` mutation surface and hook
  - Dedicated read hooks for collaboration modes and live-state
affects:
  - 07-02 mode controls use useCollaborationModes + useSetCollaborationMode
  - 07-03 user-input UI uses useThreadLiveState + useSubmitUserInput

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Endpoint modules use local envelope schemas plus protocol schemas for nested payloads
    - Hooks expose UI-agnostic read state (data/loading/error/refetch) and avoid screen coupling
    - Mutation hooks own invalidation contracts for thread detail and live-state consistency

key-files:
  created:
    - farfield/apps/mobile/src/api/live-state.ts
    - farfield/apps/mobile/src/hooks/useThreadLiveState.ts
    - farfield/apps/mobile/src/hooks/useCollaborationModes.ts
  modified:
    - farfield/apps/mobile/src/api/queryKeys.ts
    - farfield/apps/mobile/src/api/thread-actions.ts
    - farfield/apps/mobile/src/hooks/useThreadMutations.ts
    - farfield/apps/mobile/src/live/LiveUpdatesProvider.tsx

key-decisions:
  - "Live-state is a first-class query domain (`queryKeys.liveState`) rather than piggybacking on thread-detail keys"
  - "Pending user-input prompts are derived from `conversationState.requests` where method=`item/tool/requestUserInput` and `completed` is false"
  - "User-input submissions invalidate thread detail + live-state keys for the same thread"
  - "SSE detail intents also invalidate live-state keys so prompt UI remains fresh under streaming updates"

patterns-established:
  - "useThreadLiveState() treats HTTP 400 as unsupported capability and returns an empty prompt surface"
  - "Collaboration presets are fetched via dedicated list key (`collaborationModes.list`)"

requirements-completed: []

# Metrics
duration: 35min
completed: 2026-03-05
---

# Phase 07 Plan 01: Data Foundation Summary

**Typed live-state and request_user_input data plumbing landed for mobile, including query keys, hooks, and mutation invalidation paths**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-03-05T00:50:00Z
- **Completed:** 2026-03-05T01:25:46Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Added `live-state.ts` for `GET /api/threads/:id/live-state` with strict envelope parsing and pending prompt extraction helpers.
- Added typed user-input submission endpoint support in `thread-actions.ts` and `useSubmitUserInput()` mutation hook.
- Added `useThreadLiveState()` and `useCollaborationModes()` read hooks with shared `queryKeys` integration.
- Updated LiveUpdates provider invalidation to include `liveState` query keys whenever thread-detail intents fire.

## Task Commits

Each task was completed in the current workspace state:

1. **Task 1: Add typed live-state API and query keys** - *(working tree, not committed yet)*
2. **Task 2: Add submit-user-input transport + mutation** - *(working tree, not committed yet)*
3. **Task 3: Add dedicated live-state/collaboration hooks** - *(working tree, not committed yet)*

## Files Created/Modified

- `farfield/apps/mobile/src/api/live-state.ts` - Parsed live-state envelope + pending user-input extraction helper.
- `farfield/apps/mobile/src/api/queryKeys.ts` - Added `liveState.*` keys and `collaborationModes.list()` key.
- `farfield/apps/mobile/src/api/thread-actions.ts` - Added typed `submitUserInput()` action.
- `farfield/apps/mobile/src/hooks/useThreadMutations.ts` - Added `useSubmitUserInput()` invalidating detail + live-state.
- `farfield/apps/mobile/src/hooks/useThreadLiveState.ts` - Added thread live-state query hook with unsupported-capability fallback.
- `farfield/apps/mobile/src/hooks/useCollaborationModes.ts` - Added collaboration presets query hook.
- `farfield/apps/mobile/src/live/LiveUpdatesProvider.tsx` - Added live-state invalidation for thread-detail SSE intents.

## Decisions Made

- Kept live-state parsing in a dedicated API module instead of extending thread detail hook internals.
- Treated unsupported live-state capability (HTTP 400) as non-fatal to keep thread detail usable.
- Scoped invalidation to per-thread live-state keys where possible; fallback to root invalidation when thread id is unknown.

## Deviations from Plan

None - plan executed as specified.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 07 UI work can now consume `useCollaborationModes()`, `useThreadLiveState()`, `useSetCollaborationMode()`, and `useSubmitUserInput()` directly.
- Thread-detail screen can add mode switching and pending user-input response UI without additional backend/client contract work.

---
*Phase: 07-collaboration-mode-and-user-input-requests*
*Completed: 2026-03-05*
