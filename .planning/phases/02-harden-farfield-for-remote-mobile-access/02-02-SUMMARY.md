# Phase 02-02 Summary: Approval Prompt API Exposure

## Result

- Plan executed in `yolo` override mode (`--yolo`)
- Execution strategy: **Decision-dependent** (strategy choice impacted route shape and plumbing)
- Outcome: **Completed**

## Decision Checkpoint

- Chosen strategy: **dedicated approval endpoints**
  - `GET /api/threads/:id/pending-approvals`
  - `POST /api/threads/:id/pending-approvals/respond`
- Rationale: keep mobile approval contract stable and normalized without mutating existing `live-state` payload shape.

## What Was Completed

### 1. Protocol and service plumbing for approval request/response types

In `/Users/yoavhevroni/Documents/dev/codex-playground/farfield`:

- Extended `packages/codex-protocol/src/thread.ts` to support:
  - request parsing for:
    - `item/commandExecution/requestApproval`
    - `item/fileChange/requestApproval`
    - `execCommandApproval` (legacy)
    - `applyPatchApproval` (legacy)
  - response parsing via `parseThreadRequestResponsePayload` for:
    - command/file approval decisions
    - legacy exec/apply-patch review decisions
- Added generic service method:
  - `packages/codex-api/src/service.ts`
  - `submitThreadRequestResponse(...)` using existing `thread-follower-submit-user-input` IPC channel

### 2. Server API and adapter integration

- Added approval normalization helpers:
  - `apps/server/src/approvals.ts`
- Added strict request schema:
  - `apps/server/src/http-schemas.ts` (`SubmitApprovalDecisionBodySchema`)
- Added adapter type + implementation plumbing:
  - `apps/server/src/agents/types.ts`
  - `apps/server/src/agents/adapters/codex-agent.ts`
- Added server routes:
  - `apps/server/src/index.ts`
    - `GET /api/threads/:id/pending-approvals`
    - `POST /api/threads/:id/pending-approvals/respond`

### 3. Tests and docs

- Added/updated tests:
  - `apps/server/test/approvals.test.ts`
  - `apps/server/test/http-schemas.test.ts`
  - `packages/codex-api/test/service.test.ts`
  - `packages/codex-protocol/test/protocol.test.ts`
- Updated docs:
  - `README.md` with approval API curl checks

## Verification

### Focused checks

All passed:

1. `bun run --filter @farfield/protocol build`
2. `bun run --filter @farfield/api build`
3. `bun run --filter @farfield/protocol test`
4. `bun run --filter @farfield/api test`
5. `bun run --filter @farfield/server test`
6. `bun run --filter @farfield/protocol typecheck`
7. `bun run --filter @farfield/api typecheck`
8. `bun run --filter @farfield/server typecheck`
9. `bun run --filter @farfield/server lint`

### Manual endpoint verification

With `HOST=127.0.0.1 PORT=4411 FARFIELD_AUTH_TOKEN=phase02token FARFIELD_ENABLE_DEBUG_API=false`:

- pending-approvals read without auth -> `401` ✅
- pending-approvals read with auth and unknown thread -> `404` ✅
- pending-approvals read with auth on created thread -> `200` + empty list ✅
- approval respond without auth -> `401` ✅
- approval respond with unknown request id -> `404` ✅

## Deviations / Notes

- No live approval prompt was triggered during this run, so approve-path success on a real pending approval remains to be validated when prompt-generating actions are exercised.
- Existing auth/CORS hardening from `02-01` applied to new approval routes without additional policy changes.

## Files Modified By This Plan

Planning repo:
- `.planning/phases/02-harden-farfield-for-remote-mobile-access/02-CONTEXT.md`
- `.planning/phases/02-harden-farfield-for-remote-mobile-access/02-02-SUMMARY.md`
- `.planning/STATE.md`
- `.planning/ROADMAP.md`

Farfield repo:
- `README.md`
- `apps/server/src/approvals.ts`
- `apps/server/src/http-schemas.ts`
- `apps/server/src/index.ts`
- `apps/server/src/agents/types.ts`
- `apps/server/src/agents/adapters/codex-agent.ts`
- `apps/server/test/approvals.test.ts`
- `apps/server/test/http-schemas.test.ts`
- `packages/codex-api/src/service.ts`
- `packages/codex-api/test/service.test.ts`
- `packages/codex-protocol/src/thread.ts`
- `packages/codex-protocol/test/protocol.test.ts`

## Next Action

- Start Phase 03 planning (`/gsd:plan-phase 3`).
