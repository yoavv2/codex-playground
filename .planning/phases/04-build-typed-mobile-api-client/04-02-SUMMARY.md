---
phase: 04-build-typed-mobile-api-client
plan: "02"
subsystem: api
tags: [react-native, expo, tanstack-query, zod, farfield, threads, approvals]

requires:
  - phase: 04-01
    provides: fetchJson() transport, FarfieldClientError hierarchy, queryKeys factory, QueryClientProvider
  - phase: 03-03
    provides: thread screen skeletons with Phase 04 integration annotations
  - phase: 02-02
    provides: GET /api/threads/:id/pending-approvals server endpoint

provides:
  - src/api/threads.ts — listThreads() and readThread() with Zod envelope validation
  - src/api/approvals.ts — listPendingApprovals() with local Zod mirror of PendingApproval
  - src/api/agents.ts — listAgents() with AgentDescriptor schema
  - src/api/collaboration.ts — listCollaborationModes() using protocol schema
  - src/hooks/useThreads.ts — TanStack Query hook for thread list
  - src/hooks/useThread.ts — TanStack Query hook composing thread detail + pending approvals
  - Live read-only Threads tab and Thread Detail screens backed by real server data
affects:
  - 05-mvp-ui-threads-and-chat (screens ready for Phase 05 action controls)

tech-stack:
  added: []
  patterns:
    - Manual parse() helper pattern for Zod validation of complex schemas (avoids ZodIntersection TypeScript type-level issues with passthrough schemas from @farfield/protocol)
    - Flat z.object() envelope schemas instead of .and() ZodIntersection for fetchJson compatibility
    - Two-query composition in useThread() for thread detail + approvals with HTTP 400 tolerance

key-files:
  created:
    - farfield/apps/mobile/src/api/threads.ts
    - farfield/apps/mobile/src/api/approvals.ts
    - farfield/apps/mobile/src/api/agents.ts
    - farfield/apps/mobile/src/api/collaboration.ts
    - farfield/apps/mobile/src/hooks/useThreads.ts
    - farfield/apps/mobile/src/hooks/useThread.ts
  modified:
    - farfield/apps/mobile/app/(tabs)/threads.tsx
    - farfield/apps/mobile/app/thread/[threadId].tsx

key-decisions:
  - "Use flat z.object() envelope schemas instead of ZodIntersection (.and()) — avoids TypeScript _input/_output mismatch with passthrough schemas from @farfield/protocol when passed to ZodSchema<T>"
  - "Manual parse() helpers in each API module instead of schema param to fetchJson — keeps fetchJson generic-free for broad compatibility"
  - "useThread() HTTP 400 tolerance for approvals — agents without live state support return 400, treat as empty approval list not an error"
  - "Thread detail screen is read-only for Phase 04 — no composer, interrupt, or approve/deny buttons (Phase 05)"

patterns-established:
  - "API module parse pattern: fetchJson() returns unknown, module-local parse() validates with Zod schema and throws SchemaMismatchError on failure"
  - "Hook composition: useThread() encapsulates two queries (detail + approvals) so UI has one import point"
  - "Conservative retry: retry: 2 for primary thread queries, retry: false for secondary approvals query"

requirements-completed: []

duration: 6min
completed: 2026-03-04
---

# Phase 04 Plan 02: Read-Side Thread API Client Summary

**Zod-validated thread read endpoints (listThreads, readThread, listPendingApprovals), TanStack Query hooks composing thread detail + approvals, and live read-only Threads/Thread Detail screens replacing Phase 03 placeholder data**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-03-04T18:16:07Z
- **Completed:** 2026-03-04T18:22:30Z
- **Tasks:** 3
- **Files modified:** 8 (4 created API modules, 2 created hooks, 2 updated screens)

## Accomplishments

- Built four read-side API modules (`threads`, `approvals`, `agents`, `collaboration`) each with local Zod envelope schemas and a manual parse() helper that throws `SchemaMismatchError` on validation failure
- Created `useThreads()` and `useThread()` TanStack Query hooks — `useThread()` composes two reads (GET /api/threads/:id + GET /api/threads/:id/pending-approvals) and returns a unified surface for the detail screen
- Replaced Phase 03 placeholder thread UI: Threads tab now renders real thread data with loading/empty/error states and pull-to-refresh; Thread Detail renders conversation turns and pending approvals in read-only mode

## Task Commits

1. **Task 1: Build validated read endpoints** - `5aaed58` (feat — included in 04-03 combined commit)
2. **Task 2: Create query hooks for list and detail reads** - `25670e5` (feat)
3. **Task 3: Replace placeholder thread UI with live read-only data** - `8afee6f` (feat)

## Files Created/Modified

- `farfield/apps/mobile/src/api/threads.ts` — `listThreads()` and `readThread()` with AppServerThreadListItemSchema + ThreadConversationStateSchema validation
- `farfield/apps/mobile/src/api/approvals.ts` — `listPendingApprovals()` with local Zod mirror of server PendingApproval shape
- `farfield/apps/mobile/src/api/agents.ts` — `listAgents()` with local AgentDescriptor schema mirroring server buildAgentDescriptor()
- `farfield/apps/mobile/src/api/collaboration.ts` — `listCollaborationModes()` using AppServerCollaborationModeListItemSchema
- `farfield/apps/mobile/src/hooks/useThreads.ts` — thread list hook with isEmpty/isError/refetch derived state
- `farfield/apps/mobile/src/hooks/useThread.ts` — thread detail hook composing detail + approvals queries
- `farfield/apps/mobile/app/(tabs)/threads.tsx` — replaced placeholder list with real thread data, loading/empty/error states, pull-to-refresh
- `farfield/apps/mobile/app/thread/[threadId].tsx` — replaced placeholder content with turn rendering, pending approval cards, read-only

## Decisions Made

- **Flat z.object() over ZodIntersection:** Using `.and()` to compose protocol schemas with envelope fields creates `ZodIntersection<A, B>` which TypeScript rejects as incompatible with `ZodSchema<T>` / `ZodType<T>` due to `_input`/`_output` divergence in passthrough schemas. Flat `z.object()` with explicit fields avoids this entirely.
- **Manual parse() helpers:** Rather than passing complex schemas via `fetchJson({ schema })`, each API module owns its own `parse()` helper that calls `schema.safeParse()` and throws `SchemaMismatchError`. This keeps `fetchJson` clean and avoids generic type constraints leaking into Zod internals.
- **HTTP 400 tolerance in useThread():** The approvals query uses `retry: false` and the hook maps HTTP 400 errors to an empty array. Agents that don't support live state return 400 — this should not block the thread detail view.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ZodIntersection type incompatibility with fetchJson schema parameter**

- **Found during:** Task 1 (Build validated read endpoints — typecheck)
- **Issue:** Using `.and()` intersections with `@farfield/protocol` schemas produced `TS2322: Types of property '_input' are incompatible` because `ZodIntersection` has divergent input/output types with passthrough + discriminated union schemas
- **Fix:** Switched all envelope schemas from `.and()` to flat `z.object()` with inline field definitions. Added module-local `parse()` helpers that call `safeParse()` directly instead of passing schemas to `fetchJson`
- **Files modified:** `threads.ts`, `approvals.ts`, `agents.ts`, `collaboration.ts`
- **Committed in:** `5aaed58` (part of task commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — Bug)
**Impact on plan:** Required fix for correctness; no scope creep. The chosen pattern is more explicit and easier to test than generic schema passing.

## Issues Encountered

- Task 1 endpoint modules were already present in `5aaed58` (a prior plan 04-03 run included read-side modules). Tasks 2 and 3 had not been executed. Execution proceeded from Task 2 forward.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Threads tab and Thread Detail screen are wired to real server data; Phase 05 can add composer and action buttons directly
- `useThread()` already surfaces `pendingApprovals` array — Phase 05 approve/deny controls only need to call `useRespondToApproval()` mutation hook (created in 04-03)
- `useThreads()` and `useThread()` cache keys align with write-side invalidation in `useThreadMutations.ts`

---
*Phase: 04-build-typed-mobile-api-client*
*Completed: 2026-03-04*
