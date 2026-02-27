# Phase 02-01 Summary: Remote Security Hardening Baseline

## Result

- Plan executed in `yolo` override mode (`--yolo`)
- Execution strategy: **Segmented** (verify checkpoints present)
- Outcome: **Completed**

Phase 02-01 hardening work landed in the Farfield repo and verification passed after building workspace dependencies in the fresh clone.

## What Was Completed

### 1. Security policy + branch/context setup

- Created Farfield feature branch: `codex/phase-02-remote-hardening`
- Created/updated phase context:
  - `.planning/phases/02-harden-farfield-for-remote-mobile-access/02-CONTEXT.md`
- Locked route protection matrix for:
  - auth trigger
  - `/api/*` and `/events` protection
  - `/api/health` optional auth mode
  - debug API gating
  - remote allowlist CORS behavior

### 2. Server hardening implementation

In `/Users/yoavhevroni/Documents/dev/farfield`:

- Added `apps/server/src/security.ts`
  - env parsing + security config
  - auth decision helpers
  - bearer/query token resolution for `/events`
  - CORS allowlist header helpers
  - preflight origin checks
  - debug-path detection
- Updated `apps/server/src/index.ts`
  - applies dynamic CORS headers per request
  - rejects disallowed preflight origins
  - enforces auth on protected routes
  - gates `/api/debug/*` when disabled
  - removed hardcoded wildcard CORS in JSON/SSE/trace responses
- Added tests:
  - `apps/server/test/security.test.ts`
- Updated remote docs and curl checks:
  - `README.md`

### 3. Verify Checkpoint A (focused checks)

Initial run of server checks in a fresh clone failed until workspace package builds were executed.

Build prerequisite commands:

- `bun run --filter @farfield/protocol build` ✅
- `bun run --filter @farfield/api build` ✅
- `bun run --filter @farfield/opencode-api build` ✅

Then server checks:

- `bun run --filter @farfield/server test` ✅
- `bun run --filter @farfield/server typecheck` ✅
- `bun run --filter @farfield/server lint` ✅

### 4. Verify Checkpoint B (manual route checks)

Remote-bind verification run (port `4411`, because `4311` was already in use):

- unauth `/api/threads` -> `401` ✅
- auth `/api/threads` -> `200` ✅
- auth `/api/debug/history` with debug disabled -> `403` ✅
- allowed origin receives allow-origin header ✅
- disallowed origin does not receive allow-origin header ✅
- unauth `/events` -> `401` ✅
- auth `/events` -> `200` SSE stream ✅

Local-dev behavior check (port `4412`, no auth envs):

- `/api/health` -> `200` ✅
- `/api/threads` returns with wildcard local CORS (`*`) ✅

Temporary verification servers were stopped after checks.

## Deviations / Auto-Handling

- Referenced workflow/template files under `~/.codex/get-shit-done/...` were not present; execution proceeded using local planning artifacts.
- Port `4311` was occupied during manual verification, so remote checks used `4411`.

## Files Modified By This Plan

Planning repo:
- `.planning/phases/02-harden-farfield-for-remote-mobile-access/02-CONTEXT.md`
- `.planning/phases/02-harden-farfield-for-remote-mobile-access/02-01-SUMMARY.md`
- `.planning/STATE.md`
- `.planning/ROADMAP.md`

Farfield repo:
- `apps/server/src/security.ts`
- `apps/server/src/index.ts`
- `apps/server/test/security.test.ts`
- `README.md`

## Next Action

- Execute `.planning/phases/02-harden-farfield-for-remote-mobile-access/02-02-PLAN.md` to implement approval prompt API exposure.
