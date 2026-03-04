---
phase: 05-mvp-ui-threads-and-chat
plan: "02"
subsystem: ui
tags: [react-native, expo, tanstack-query, flatlist, keyboard-avoiding-view, refresh-control, mobile-chat]

# Dependency graph
requires:
  - phase: 04-build-typed-mobile-api-client
    provides: useThread hook, useSendMessage mutation, ThreadDetailEnvelope type
provides:
  - Interactive thread detail screen with pull-to-refresh and message composer
  - isRefreshing / isLoading distinction in useThread hook for background-safe UX
  - Composer component with send state, error feedback, and draft management
affects:
  - 05-03 (interrupt/approval controls build on this chat surface)
  - 06 (SSE live updates will plug into the same thread detail screen)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - FlatList with RefreshControl for pull-to-refresh instead of ScrollView
    - KeyboardAvoidingView wrapping FlatList + bottom composer for stable layout
    - isLoading (initial gate) vs isRefreshing (background indicator) from TanStack Query
    - Composer component owns draft state and useSendMessage mutation lifecycle
    - Module-level ListItem discriminated union to satisfy FlatList<T> ref generic

key-files:
  created: []
  modified:
    - farfield/apps/mobile/src/hooks/useThread.ts
    - farfield/apps/mobile/app/thread/[threadId].tsx

key-decisions:
  - "isRefreshing derived as isFetching && !isLoading so background refetches do not trigger full-screen loading state"
  - "ListItem discriminated union defined at module scope (not inside function) to satisfy useRef<FlatList<ListItem>> generic constraint"
  - "Composer calls scrollToEnd onSuccess for scroll-to-bottom after send"
  - "Single commit for Tasks 2+3 because the composer is implemented inline within the screen file"
  - "Bundle verified via expo export --platform ios rather than metro start to avoid port conflicts in CI-like environment"

patterns-established:
  - "Pull-to-refresh pattern: RefreshControl driven by hook isRefreshing, onRefresh calls hook refetch()"
  - "Keyboard-safe layout: KeyboardAvoidingView behavior='padding' on iOS, behavior='height' on Android"
  - "Turn bubble differentiation: user turns right-aligned blue, agent turns left-aligned white"

requirements-completed: []

# Metrics
duration: 3min
completed: 2026-03-04
---

# Phase 05 Plan 02: Thread Detail Chat Surface Summary

**Thread detail route converted to a mobile chat surface with pull-to-refresh, differentiated turn bubbles, and a useSendMessage-backed composer**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-04T18:46:08Z
- **Completed:** 2026-03-04T18:49:07Z
- **Tasks:** 3 (Tasks 2 and 3 committed together as one file)
- **Files modified:** 2

## Accomplishments

- `useThread` hook now exposes `isRefreshing` (background refetch indicator) separate from `isLoading` (initial gate), so the screen stays stable during pull-to-refresh cycles
- Thread detail screen rebuilt with `FlatList` + `RefreshControl` + `KeyboardAvoidingView` — scrollable history with pull-to-refresh that keeps content visible during background refetches
- User vs agent turns visually differentiated (blue right-aligned vs white left-aligned bubbles) for mobile scanability
- Composer added: `TextInput` + Send button backed by `useSendMessage()`; trims input, blocks empty sends, disables during pending mutation, clears draft on success, surfaces inline error text

## Task Commits

Each task was committed atomically:

1. **Task 1: Expose interactive fetch state from the thread-detail hook** - `50f2a4a` (feat)
2. **Task 2+3: Reshape detail route + wire composer** - `2b2d568` (feat)

## Files Created/Modified

- `farfield/apps/mobile/src/hooks/useThread.ts` — Added `isRefreshing` field and updated JSDoc for load-vs-refresh distinction
- `farfield/apps/mobile/app/thread/[threadId].tsx` — Full rewrite: FlatList, RefreshControl, KeyboardAvoidingView, TurnCard differentiation, Composer component

## Decisions Made

- `isRefreshing` computed as `isFetching && !isLoading` — preserves TanStack Query v5 semantics; background invalidation from `useSendMessage` success doesn't hide the screen
- `ListItem` type moved to module scope (not inside screen function) to satisfy `useRef<FlatList<ListItem>>` TypeScript constraint — refs require a generic type available at declaration site
- Composer placed as a sibling component in the same file; Phase 05 scope does not warrant a separate file

## Deviations from Plan

None — plan executed exactly as written. Tasks 2 and 3 were committed in a single commit because both are implemented in the same screen file and the composer is integral to the layout change, but the plan grouped them into the same file anyway.

## Issues Encountered

**[Rule 1 - Bug] FlatList ref generic type mismatch**
- `useRef<FlatList<Turn>>` conflicted with `FlatList<ListItem>` because `ListItem` was defined inside the component function body
- Fix: moved `ListItem` discriminated union type to module scope and changed ref to `useRef<FlatList<ListItem>>`
- Lint error resolved; both typecheck and lint pass

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Thread detail screen is a functional read-and-send loop; ready for Phase 05 plan 03 (interrupt + approval controls)
- `isRefreshing` hook field is available for Phase 06 (SSE live updates) to drive real-time refresh indicators
- Composer layout reserves stable bottom space; approval/interrupt buttons can be added above the composer in the next plan

---
*Phase: 05-mvp-ui-threads-and-chat*
*Completed: 2026-03-04*

## Self-Check: PASSED

- farfield/apps/mobile/src/hooks/useThread.ts: FOUND
- farfield/apps/mobile/app/thread/[threadId].tsx: FOUND
- .planning/phases/05-mvp-ui-threads-and-chat/05-02-SUMMARY.md: FOUND
- commit 50f2a4a (Task 1): FOUND
- commit 2b2d568 (Tasks 2+3): FOUND
