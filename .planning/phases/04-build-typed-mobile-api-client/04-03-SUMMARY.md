---
phase: 04-build-typed-mobile-api-client
plan: "03"
subsystem: api
tags: [react-native, tanstack-query, zod, sse, react-native-sse, typescript]

# Dependency graph
requires:
  - phase: 04-build-typed-mobile-api-client
    provides: fetchJson() authenticated transport, queryKeys factory, QueryClientProvider at root
  - phase: 02-harden-farfield-for-remote-mobile-access
    provides: approval endpoints (POST /pending-approvals/respond), auth/CORS hardening contracts
provides:
  - sendMessage() typed client for POST /api/threads/:id/messages
  - interruptThread() typed client for POST /api/threads/:id/interrupt
  - setCollaborationMode() typed client for POST /api/threads/:id/collaboration-mode
  - respondToApproval() typed client for POST /api/threads/:id/pending-approvals/respond
  - useSendMessage, useInterruptThread, useSetCollaborationMode, useRespondToApproval mutation hooks with cache invalidation
  - subscribeEvents() low-level SSE helper for /events with Authorization header auth
  - useFarfieldEvents() React hook wrapper for SSE lifecycle management
affects:
  - 05-mvp-ui-threads-and-chat
  - 06-live-updates-sse-and-reconnect

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ZodType<T> (not ZodSchema<T>) as schema param type for complex nested schema compatibility"
    - "Flat z.object() schemas for server envelopes instead of ZodIntersection (.and()) to avoid input/output type divergence"
    - "Handlers ref pattern in useFarfieldEvents to keep effect stable while handlers update"
    - "Mutation hooks own cache invalidation; UI code never calls queryClient directly for writes"

key-files:
  created:
    - farfield/apps/mobile/src/api/messages.ts
    - farfield/apps/mobile/src/api/thread-actions.ts
    - farfield/apps/mobile/src/api/events.ts
    - farfield/apps/mobile/src/hooks/useThreadMutations.ts
    - farfield/apps/mobile/src/hooks/useFarfieldEvents.ts
  modified:
    - farfield/apps/mobile/src/api/client.ts
    - farfield/apps/mobile/src/api/threads.ts

key-decisions:
  - "ZodType<T> used instead of ZodSchema<T> in fetchJson() schema param — ZodSchema checks both _input and _output types causing TS2322 with passthrough/discriminated-union schemas from @farfield/protocol"
  - "Flat z.object() for response envelopes instead of .and() ZodIntersection — intersection type variance breaks with complex nested schemas (discriminated unions with .default())"
  - "Mutation hooks invalidate by key specificity: detail+list for send/interrupt, detail+collaborationModes for mode switch, approvals+detail for approval response"
  - "SSE auth uses Authorization: Bearer header; no query-param fallback needed since react-native-sse sends headers on all target platforms"
  - "Reconnect policy in Phase 06; subscribeEvents() intentionally keeps basic reconnect (server-driven retry:1000)"
  - "handlersRef pattern in useFarfieldEvents avoids re-subscribing on inline handler changes"

patterns-established:
  - "Write-side client modules (messages.ts, thread-actions.ts) mirror server http-schemas.ts contracts with local Zod schemas"
  - "Mutation hooks in useThreadMutations.ts are the single import Phase 05 needs for all thread writes"
  - "subscribeEvents() returns cleanup function; useFarfieldEvents() manages lifecycle in useEffect"

requirements-completed: []

# Metrics
duration: 6min
completed: 2026-03-04
---

# Phase 04 Plan 03: Write-side API Client and SSE Subscription Summary

**Typed write-side client methods, TanStack Query mutation hooks with cache invalidation, and authenticated SSE subscription helper — completing the Phase 04 client surface for Phase 05 UI wiring**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-03-04T18:16:20Z
- **Completed:** 2026-03-04T18:21:40Z
- **Tasks:** 3
- **Files modified:** 7 (5 created, 2 fixed)

## Accomplishments

- Write-side client complete: sendMessage, interruptThread, setCollaborationMode, respondToApproval — all with Zod-validated server envelopes
- Mutation hooks with predictable cache invalidation rules defined once in useThreadMutations.ts; Phase 05 imports one module for all write operations
- Authenticated SSE subscription primitive (subscribeEvents + useFarfieldEvents) ready for Phase 05/06 event wiring

## Task Commits

Each task was committed atomically:

1. **Task 1: Create typed write-side client modules** - `5aaed58` (feat)
2. **Task 2: Expose mutation hooks with cache invalidation** - `70041da` (feat)
3. **Task 3: Implement /events subscription helper** - `e08d607` (feat)

## Files Created/Modified

- `farfield/apps/mobile/src/api/messages.ts` - sendMessage() for POST /api/threads/:id/messages
- `farfield/apps/mobile/src/api/thread-actions.ts` - interruptThread(), setCollaborationMode(), respondToApproval()
- `farfield/apps/mobile/src/api/events.ts` - subscribeEvents() low-level SSE helper
- `farfield/apps/mobile/src/hooks/useThreadMutations.ts` - Four mutation hooks with cache invalidation
- `farfield/apps/mobile/src/hooks/useFarfieldEvents.ts` - React hook for SSE lifecycle
- `farfield/apps/mobile/src/api/client.ts` - Fixed: ZodType<T> instead of ZodSchema<T>
- `farfield/apps/mobile/src/api/threads.ts` - Fixed: flat z.object() instead of ZodIntersection

## Decisions Made

- `ZodType<T>` instead of `ZodSchema<T>` in `fetchJson()` — `ZodSchema<T>` constrains both input and output generic params, causing TS2322 errors with passthrough/discriminated-union schemas from `@farfield/protocol` where `_input` and `_output` diverge.
- Flat `z.object()` for response envelopes in threads.ts — `.and()` produces `ZodIntersection` which has the same input/output variance issue. Flat objects pass `ZodType<T>` cleanly.
- Cache invalidation by specificity: send/interrupt invalidate `threads.detail` + `threads.list`; collaboration-mode invalidates `threads.detail` + `collaborationModes.forThread`; approval response invalidates `approvals.pending` + `threads.detail`.
- SSE auth: `Authorization: Bearer` header only — no query-param fallback since `react-native-sse` supports custom headers on all target platforms.
- Reconnect strategy deferred to Phase 06; `subscribeEvents()` relies on server's `retry: 1000` directive.
- `handlersRef` pattern in `useFarfieldEvents` prevents the `useEffect` from re-running when callers pass inline handler functions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed ZodSchema<T> type constraint in fetchJson() causing TS2322 with protocol schemas**
- **Found during:** Task 1 (create typed write-side client modules)
- **Issue:** `fetchJson()` used `ZodSchema<T>` as the schema param type. `ZodSchema<T>` constrains both `_input` and `_output` type params. Complex schemas from `@farfield/protocol` (using `.passthrough()`, `.default()`, and discriminated unions) diverge on input vs output types, causing TypeScript errors on the `schema` argument.
- **Fix:** Changed `import { type ZodSchema }` to `import { type ZodType }` in `client.ts` and updated the `FetchJsonOptions.schema` field. `ZodType<T>` only constrains the output type.
- **Files modified:** `farfield/apps/mobile/src/api/client.ts`
- **Verification:** `bun run --filter @farfield/mobile typecheck` exits 0
- **Committed in:** `5aaed58` (Task 1 commit)

**2. [Rule 1 - Bug] Fixed ZodIntersection (.and()) schema composition in threads.ts causing TS2322**
- **Found during:** Task 1 — discovered pre-existing error in threads.ts created by Phase 04-02
- **Issue:** `threads.ts` used `.and()` to merge `ok: true` into protocol response schemas. `ZodIntersection` produces `_input` types incompatible with `_output` types on nested schemas, triggering TS2322.
- **Fix:** Rewrote envelope schemas as flat `z.object()` with the required fields inlined (no intersection). The protocol schemas already expose `AppServerThreadListItemSchema` and `ThreadConversationStateSchema` for direct use.
- **Files modified:** `farfield/apps/mobile/src/api/threads.ts`
- **Verification:** `bun run --filter @farfield/mobile typecheck` exits 0
- **Committed in:** `5aaed58` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 bugs in pre-existing code from 04-02 plan)
**Impact on plan:** Both fixes necessary for typecheck to pass. No scope creep.

## Issues Encountered

The Phase 04-02 plan left read-side modules (`threads.ts`, `agents.ts`, `approvals.ts`, `collaboration.ts`) in the working tree uncommitted. These were included in the Task 1 commit along with the write-side modules. The type errors introduced by those files (ZodIntersection issues) were auto-fixed as Rule 1 bugs.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

Phase 05 (MVP UI - Threads and Chat) can now:
- Import `useSendMessage`, `useInterruptThread`, `useSetCollaborationMode`, `useRespondToApproval` from `@/src/hooks/useThreadMutations`
- Import `useFarfieldEvents` from `@/src/hooks/useFarfieldEvents` for SSE event consumption
- Import read-side hooks from `@/src/hooks/useThreads`, `@/src/hooks/useApprovals` (to be created in Phase 05 or already available from 04-02)
- All cache invalidation rules are defined once; no rework needed

No blockers for Phase 05 start.

---
*Phase: 04-build-typed-mobile-api-client*
*Completed: 2026-03-04*
