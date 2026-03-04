---
phase: 05-mvp-ui-threads-and-chat
plan: "01"
subsystem: ui
tags: [react-native, tanstack-query, expo-router, threads, search, filter]

# Dependency graph
requires:
  - phase: 04-build-typed-mobile-api-client
    provides: useThreads hook, FarfieldClientError hierarchy, ThreadListItem type
provides:
  - Local text search/filter on thread list (title, id, preview)
  - isFirstLoad / isRefreshing distinction in useThreads for non-blocking refresh UX
  - sortedThreads (updatedAt descending) from useThreads
  - Source badge on thread list rows
  - Split empty states (no threads vs no filter results)
  - REST-derived connection banner (connected / auth-failed / unreachable / timeout / configure-server)
affects:
  - 05-02 (thread detail / chat screen may consume same hook patterns)
  - 06 (SSE reconnect phase will replace/augment the connection banner logic)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - isFirstLoad vs isRefreshing distinction for pull-to-refresh without full-screen reload
    - deriveConnectionStatus() maps typed error hierarchy to simple UI states
    - useMemo-filtered list preserves hook sort order
    - Split empty states based on whether a filter is active

key-files:
  created: []
  modified:
    - farfield/apps/mobile/src/hooks/useThreads.ts
    - farfield/apps/mobile/app/(tabs)/threads.tsx

key-decisions:
  - "isFirstLoad = isLoading && !data (true only before first successful fetch); isRefreshing = isFetching && !isLoading (background/manual refetch with existing data)"
  - "Connection banner uses only REST query state — no SSE or reconnect machine; Phase 06 owns live connection lifecycle"
  - "threadMatchesFilter checks title, id, and preview — all three visible identifiers a user might type"
  - "Source badge defaults to 'codex' when thread has no source field — safe fallback for generated thread shape"
  - "Empty states split: NoThreadsEmptyState for server-empty, NoResultsEmptyState for filtered-empty"

patterns-established:
  - "isFirstLoad/isRefreshing pattern: gate full-screen spinner on isFirstLoad only; RefreshControl uses isRefreshing"
  - "deriveConnectionStatus(): typed error instanceof checks map to a ConnectionStatus union; banner renders from that union"
  - "useMemo filter + sort separation: hook owns sort, screen owns filter"

requirements-completed: []

# Metrics
duration: 9min
completed: 2026-03-04
---

# Phase 05 Plan 01: Threads Browse Surface Summary

**Threads tab upgraded to MVP browse surface with local text search, updatedAt-sorted list, non-blocking pull-to-refresh, source badges, and a REST-derived connection banner**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-03-04T18:46:00Z
- **Completed:** 2026-03-04T18:48:36Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- Expanded `useThreads` hook to distinguish initial load from background refetch (`isFirstLoad`/`isRefreshing`), expose threads sorted by `updatedAt` descending, and use a stable `useCallback` refetch
- Upgraded Threads screen with `TextInput` local filter (title/id/preview), split empty states, source badges, and non-blocking `RefreshControl` using `isRefreshing`
- Added compact connection banner mapping the typed `FarfieldClientError` hierarchy to five distinct user-facing states without touching SSE or reconnect machinery

## Task Commits

Each task was committed atomically:

1. **Task 1: Expand useThreads hook for UI-ready fetch state** - `3f15b1a` (feat)
2. **Task 2 + 3: Local search, richer rows, connection banner** - `642daa7` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `farfield/apps/mobile/src/hooks/useThreads.ts` — Added `isFirstLoad`, `isRefreshing`, `sortedThreads`; stable refetch via `useCallback`; backward-compat `isLoading`/`threads` aliases
- `farfield/apps/mobile/app/(tabs)/threads.tsx` — TextInput search bar, `useMemo` filter, source badge, split empty states, `ConnectionBanner` with five status variants, `RefreshControl` using `isRefreshing`

## Decisions Made

- `isFirstLoad` = `query.isLoading && !query.data` — true only before first successful fetch, stays false during all subsequent background fetches even with stale data
- `isRefreshing` = `query.isFetching && !query.isLoading` — the right condition for pull-to-refresh state since TanStack Query sets `isFetching=true` during manual refetch without going back to `isLoading`
- Connection banner intentionally limited to REST-derived states; Phase 06 owns SSE reconnect and live connection status
- Threefold filter surface (title + id + preview) covers all visible identifiers

## Deviations from Plan

None — plan executed exactly as written. Tasks 2 and 3 shared a single commit because the connection banner and search were built together in one cohesive screen rewrite, which avoided a partially-functional intermediate state.

## Issues Encountered

None. All three verification commands passed: typecheck, lint, and Metro offline start.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 05 plan 02 (thread detail / chat) can import the same `isFirstLoad`/`isRefreshing` pattern from `useThread` hooks
- Connection banner styling and status enum are extensible; Phase 06 adds SSE-driven states by expanding `ConnectionStatus` union
- Local search filter is stateless and thread-scoped; pagination or server-side search can replace it later without changing the filter component interface

---
*Phase: 05-mvp-ui-threads-and-chat*
*Completed: 2026-03-04*
