# Phase 02 Context: Harden Farfield for Remote Mobile Access

## Phase Goal

Harden the Farfield server for safe remote mobile use before building the mobile app. Phase 02 is split into two execution plans:

- `02-01`: auth, CORS allowlist, debug API gating, docs, and verification
- `02-02`: approval prompt API exposure (pending approvals + approve/deny actions)

## Target Repo

- Repo: `/Users/yoavhevroni/Documents/dev/codex-playground/farfield`
- Remote: `https://github.com/achimala/farfield`
- Working branch for `02-01`: `codex/phase-02-remote-hardening`

## Confirmed Inputs From Phase 01

- Tailscale is the required remote transport path for MVP/personal use
- Remote security baseline is required before real phone usage
- Approval prompt support is MVP-blocking but handled in `02-02`
- Local Farfield repo structure is validated (`apps/server`, `apps/web`, `packages/codex-protocol`)

## Phase 02 Plan Split

### 02-01 Scope (completed)

- Token auth for protected routes when configured
- `/events` auth protection
- CORS allowlist support for remote use
- Debug API gating for remote use
- README updates and curl verification steps

### 02-02 Scope (completed)

- Pending approvals read path
- Approve/deny actions
- Strict payload contract for mobile UI integration

## Route Protection Matrix (02-01 Decision)

### Auth policy trigger

- Auth is enforced when `FARFIELD_AUTH_TOKEN` is set to a non-empty value.

### Protected routes when auth is enabled

- `/api/*` routes (except `/api/health` by default)
- `/events`

### `/api/health` policy (02-01 decision)

- Default: not auth-protected
- Optional hardening via `FARFIELD_REQUIRE_AUTH_FOR_HEALTH=true`
- Rationale: preserve simple operational checks while allowing stricter remote deployments

### `/events` token transport

- Prefer `Authorization: Bearer <token>`
- Also support `access_token` query parameter for SSE client compatibility

### Debug API policy

- `/api/debug/*` gated by `FARFIELD_ENABLE_DEBUG_API`
- Default behavior in remote bind mode (`HOST` not local-only): disabled
- Local bind mode defaults to enabled unless explicitly disabled

### CORS policy

- Remote use should rely on `FARFIELD_ALLOWED_ORIGINS` allowlist (no wildcard)
- Local development without remote config preserves current permissive behavior
- Preflight requests should include `authorization` in allowed headers when auth is used

## Implementation Notes (02-01 Execution)

Implemented in Farfield repo on `codex/phase-02-remote-hardening`:

- Added `apps/server/src/security.ts` with deterministic security helpers:
  - env parsing (`FARFIELD_AUTH_TOKEN`, `FARFIELD_ALLOWED_ORIGINS`, `FARFIELD_ENABLE_DEBUG_API`, `FARFIELD_REQUIRE_AUTH_FOR_HEALTH`)
  - auth route-matching and token extraction
  - CORS header construction and preflight origin checks
  - debug route detection
- Updated `apps/server/src/index.ts`:
  - applies CORS headers per request
  - validates preflight origins
  - enforces auth on protected routes
  - gates debug routes when disabled
  - removes hardcoded wildcard CORS from JSON/SSE/trace-download responses
- Added focused unit tests in `apps/server/test/security.test.ts`
- Updated remote docs and curl verification guidance in `README.md`

## Verification Results (02-01)

### Checkpoint A: Focused checks

Commands run in `/Users/yoavhevroni/Documents/dev/codex-playground/farfield`:

1. `bun run --filter @farfield/protocol build` ✅
2. `bun run --filter @farfield/api build` ✅
3. `bun run --filter @farfield/opencode-api build` ✅
4. `bun run --filter @farfield/server test` ✅
5. `bun run --filter @farfield/server typecheck` ✅
6. `bun run --filter @farfield/server lint` ✅

Note:
- Initial server test/typecheck/lint run failed before workspace package builds because a fresh clone did not yet have built workspace outputs. After the package builds, all three server checks passed.

### Checkpoint B: Manual HTTP/SSE verification

Remote-bind verification server run:
- `HOST=0.0.0.0 PORT=4411 FARFIELD_AUTH_TOKEN=phase02token FARFIELD_ALLOWED_ORIGINS=http://127.0.0.1:4312 FARFIELD_ENABLE_DEBUG_API=false bun run --filter @farfield/server dev -- --agents=codex`
- Port `4311` was already in use locally, so verification used `4411`.

Observed results:
- `GET /api/threads` without token -> `401` ✅
- `GET /api/threads` with bearer token -> `200` ✅
- `GET /api/debug/history` with token and debug disabled -> `403` ✅
- `GET /api/threads` with allowed origin header includes `Access-Control-Allow-Origin: http://127.0.0.1:4312` ✅
- `GET /api/threads` with disallowed origin omits allow-origin header ✅
- `GET /events` without token -> `401` ✅
- `GET /events` with bearer token -> `200` stream response ✅

Local-dev usability check:
- Started local bind server on `127.0.0.1:4412` with no auth envs
- `GET /api/health` without token -> `200` ✅
- `GET /api/threads` includes `Access-Control-Allow-Origin: *` in local mode ✅

Cleanup:
- Temporary verification servers on `4411` and `4412` were stopped after checks.

## 02-02 Discovery Findings

### Capability inventory (from code + schema inspection)

| Area | Available | Missing / Gap | Action Taken |
| --- | --- | --- | --- |
| `conversationState.requests` typing | `item/tool/requestUserInput` | approval request methods were not represented in `packages/codex-protocol/src/thread.ts` | Added strict request schemas for command/file/legacy apply-patch + request union |
| Approval response typing | only `ToolRequestUserInputResponse` parser | no typed parser for approval responses | Added strict response schemas + `parseThreadRequestResponsePayload` |
| `codex-api` service | `submitUserInput` via `thread-follower-submit-user-input` | no explicit generic request-response method | Added `submitThreadRequestResponse` and kept `submitUserInput` as typed wrapper |
| Server HTTP API | `GET /api/threads/:id/live-state`, `POST /api/threads/:id/user-input` | no approval read/action routes | Added dedicated pending approvals read/respond routes |

### Decision checkpoint outcome

- Chosen strategy: **dedicated endpoints** instead of extending `live-state` payload.
- Rationale:
  - avoids coupling approval contract to full `conversationState` response evolution
  - gives a mobile-specific, normalized payload for polling and rendering
  - minimizes risk for existing `live-state` consumers

## 02-02 API Contract (for Phase 04 mobile client)

### Read pending approvals

- Route: `GET /api/threads/:id/pending-approvals`
- Auth: same Phase 02 auth gate as other `/api/*` routes
- Response shape:
  - `pendingApprovals[]` entries include:
    - `requestId`
    - `requestMethod`
    - `type` (`command` | `file-change` | `apply-patch`)
    - `status` (`pending`)
    - `threadId`, `turnId`, `itemId`, `approvalId`
    - `summary`
    - `detail` (stringified fields needed for UI)

### Submit approval decision

- Route: `POST /api/threads/:id/pending-approvals/respond`
- Body:
  - `requestId: number`
  - `decision: "approve" | "deny"`
  - optional `ownerClientId`
- Mapping semantics:
  - command/file request methods -> `accept`/`decline`
  - legacy exec/apply-patch methods -> `approved`/`denied`
- Error semantics:
  - `404` when request id is not currently pending for thread
  - `401` when auth token is missing/invalid
  - `500` for downstream transport or handler failures

## 02-02 Implementation Notes

Implemented in `/Users/yoavhevroni/Documents/dev/codex-playground/farfield`:

- Added server approval helper module:
  - `apps/server/src/approvals.ts`
- Updated server routes:
  - `apps/server/src/index.ts`
  - added `GET /api/threads/:id/pending-approvals`
  - added `POST /api/threads/:id/pending-approvals/respond`
- Added strict schema for approval route body:
  - `apps/server/src/http-schemas.ts`
- Added generic request-response plumbing:
  - `apps/server/src/agents/types.ts`
  - `apps/server/src/agents/adapters/codex-agent.ts`
  - `packages/codex-api/src/service.ts`
- Extended protocol thread/request parsing:
  - `packages/codex-protocol/src/thread.ts`
- Added/updated tests:
  - `apps/server/test/approvals.test.ts`
  - `apps/server/test/http-schemas.test.ts`
  - `packages/codex-api/test/service.test.ts`
  - `packages/codex-protocol/test/protocol.test.ts`
- Updated docs:
  - `README.md` approval API verification commands

## Verification Results (02-02)

### Checkpoint A: Focused package checks

Run in `/Users/yoavhevroni/Documents/dev/codex-playground/farfield`:

1. `bun run --filter @farfield/protocol build` ✅
2. `bun run --filter @farfield/api build` ✅
3. `bun run --filter @farfield/protocol test` ✅
4. `bun run --filter @farfield/api test` ✅
5. `bun run --filter @farfield/server test` ✅
6. `bun run --filter @farfield/protocol typecheck` ✅
7. `bun run --filter @farfield/api typecheck` ✅
8. `bun run --filter @farfield/server typecheck` ✅
9. `bun run --filter @farfield/server lint` ✅

### Checkpoint B: Manual API checks

Remote-secured local run:
- `HOST=127.0.0.1 PORT=4411 FARFIELD_AUTH_TOKEN=phase02token FARFIELD_ENABLE_DEBUG_API=false bun run --filter @farfield/server dev -- --agents=codex`

Observed:
- `GET /api/threads/:id/pending-approvals` without auth -> `401` ✅
- `GET /api/threads/:id/pending-approvals` with auth and unknown thread -> `404` ✅
- `GET /api/threads/:id/pending-approvals` with auth on created thread -> `200` with `pendingApprovals: []` ✅
- `POST /api/threads/:id/pending-approvals/respond` without auth -> `401` ✅
- `POST /api/threads/:id/pending-approvals/respond` with missing request id -> `404` ✅

## Known Limitations for Phase 04

- Decision mapping is implemented and typed, but this run did not produce a live approval prompt from Codex, so approve-path success against a real pending request remains to be validated during mobile integration.
- `detail` fields intentionally preserve some complex structures as JSON strings for transport stability; Phase 04 UI can parse selected fields for richer rendering.
