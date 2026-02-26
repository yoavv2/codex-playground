# Phase 01 Context: Prep and Decisions

## Phase Goal

Lock the key implementation decisions required to start the Farfield hardening work (Phase 02) without re-opening architecture and security questions. This phase is planning-only and focuses on decisions, scope boundaries, and a clean handoff into backend implementation.

## Decision Checklist (Execution Outcome)

### Lock Now

- Repo strategy default: **Option A** (Farfield fork with `apps/mobile`)
- Remote transport path for MVP/personal use: **Tailscale**
- MVP remote safety baseline for Phase 02: auth + `/events` auth + CORS allowlist + debug endpoint gating
- Approval prompt support (`command`, `file-change`, `apply-patch`) is MVP-blocking and must be represented in backend/protocol + client plan
- Core mobile defaults: Expo (TypeScript), Expo Router, TanStack Query, `expo-secure-store`

### Defer Intentionally

- Final React Native SSE library selection (Phase 03, with criteria)
- Health endpoint auth requirement (`/api/health`) final behavior (Phase 02)
- Remote-mode rate limiting and sensitive-log redaction in first pass vs follow-up patch (Phase 02)

### Resolved During Follow-up

- Farfield fork URL provided: `https://github.com/achimala/farfield`
- Local clone created at `/Users/yoavhevroni/Documents/dev/farfield`
- Default branch confirmed: `main`

## Confirmed Decisions

### Repo Strategy

- **Chosen default:** Option A (Farfield fork + `apps/mobile`)
- Rationale:
  - keeps backend hardening and mobile client work in one repo
  - enables easier reuse of shared protocol definitions
  - reduces version drift between API and app
- Validation:
  - monorepo layout confirmed with `apps/server`, `apps/web`, and `packages/codex-protocol`
- Local target repo:
  - Path: `/Users/yoavhevroni/Documents/dev/farfield`
  - Branch: `main` (create feature branch before implementation if desired)

### Remote Transport

- **Confirmed:** Tailscale is the required transport path for MVP/personal remote use
- **Rejected for MVP:** public internet exposure / raw port forwarding

### Mobile Implementation Defaults

- App framework: Expo + TypeScript
- Routing: Expo Router
- Data/query layer: TanStack Query
- Auth/token storage: `expo-secure-store`
- SSE library: deferred to Phase 03 discovery/validation

### Approval Prompt MVP Scope (Command/File/Apply-Patch)

Approval prompts are MVP-blocking for real remote use because Codex can pause on approvals during normal workflows.

Minimum capability requirements (backend/protocol + client contract):
- list pending approvals for a thread (or expose them in thread live-state)
- include stable `approval_id`
- include `thread_id`
- include prompt `type` (`command`, `file-change`, `apply-patch`)
- include prompt status (pending/resolved)
- include sufficient display payload for mobile review (summary + actionable details)
- approve action for a specific approval
- deny/reject action for a specific approval
- response result/status so the client can refresh and clear prompt state

Implementation split:
- **Phase 02 (backend/protocol prep):** define and expose approval prompt API shape / server endpoints (or live-state augmentation)
- **Phase 04 (client integration):** render pending approvals and approve/deny actions in thread UI

### Phase 02 Hardening Scope Boundary

Required in initial Phase 02 implementation:
- Bearer token auth for `/api/*`
- Auth protection for `/events`
- CORS allowlist for remote mode (no wildcard)
- Debug endpoint gating (`/api/debug/*`) disabled by default in remote mode

Optional (decide during Phase 02 execution if low effort / high value):
- auth requirement for `/api/health`
- simple rate limiting in remote mode
- sensitive log redaction

## Deferred Decisions

### React Native SSE Library (Phase 03)

Decision owner:
- Phase 03: Create Expo App Skeleton

Decision criteria:
- RN/Expo compatibility
- reconnection behavior control
- maintenance/activity level
- support for auth strategy (headers or query token fallback for SSE)
- acceptable developer ergonomics

## Blockers

- No active blockers for Phase 02 planning.
- Target repo is available locally at `/Users/yoavhevroni/Documents/dev/farfield` on branch `main`.

## Repo Readiness Notes (Discovery)

Discovery performed:
- searched `/Users/yoavhevroni/Documents/dev` (depth 3) for directories matching `farfield`
- searched `/Users/yoavhevroni` (depth 4) for directories matching `*farfield*`

Result:
- no local Farfield repo/fork was found in the searched locations

Follow-up discovery (after repo URL was provided):
- cloned `https://github.com/achimala/farfield` to `/Users/yoavhevroni/Documents/dev/farfield`
- default branch is `main`
- repo root package name is `farfield` with Bun workspaces (`apps/*`, `packages/*`)
- monorepo layout confirmed:
  - `apps/server`
  - `apps/web`
  - `packages/codex-protocol`
  - `packages/codex-api`
  - `packages/opencode-api`
- server entrypoint confirmed at `apps/server/src/index.ts`
- route coverage confirmed in `apps/server/src/index.ts`:
  - `GET /events`
  - `GET /api/health`
  - `GET /api/agents`
  - thread routes under `/api/threads/*`
  - `GET /api/threads/:id/live-state`
  - `POST /api/threads/:id/user-input`
  - debug routes under `/api/debug/*` (history/replay/trace)
- current implementation notes:
  - JSON responses and SSE currently use wildcard CORS (`Access-Control-Allow-Origin: *`)
  - no bearer auth middleware is currently applied to `/api/*` or `/events`
- protocol evidence in `packages/codex-protocol/vendor/codex-app-server-schema` includes:
  - `ExecCommandApproval*`
  - `FileChangeRequestApproval*`
  - `ApplyPatchApproval*`
  - `ToolRequestUserInput*`

Validation status:
- monorepo fit for Option A is validated at a structural level
- Phase 02 planning is unblocked

## Phase 02 Handoff Notes

Phase 02 should start with:

1. Implement auth/CORS/debug gating in `apps/server/src/index.ts` (route handling location confirmed)
2. Implement token auth middleware with local-dev fallback when no token is configured
3. Protect `/events` with the same auth policy (query token fallback only if SSE client compatibility requires it)
4. Add remote-mode CORS allowlist env (`FARFIELD_ALLOWED_ORIGINS`)
5. Gate debug endpoints with `FARFIELD_ENABLE_DEBUG_API` (default disabled in remote mode)
6. Inspect `GET /api/threads/:id/live-state` payload shape to determine whether approval prompts can ride existing live-state responses
7. Define/implement approval prompt API shape (pending approvals + approve/deny) using existing codex protocol approval schema concepts
8. Update `apps/server/src/http-schemas.ts` for any new request bodies
9. Document safe Tailscale-based startup and env usage

Required env vars to implement/document in Phase 02:
- `FARFIELD_AUTH_TOKEN`
- `FARFIELD_ALLOWED_ORIGINS`
- `FARFIELD_ENABLE_DEBUG_API`
- Optional: `FARFIELD_REQUIRE_AUTH_FOR_HEALTH`

Acceptance test outline for Phase 02:
- request without token to protected API returns `401`
- request with valid token succeeds
- `/events` rejects unauthenticated access
- `/events` accepts authenticated access
- debug endpoints are disabled when remote mode debug flag is off
- local behavior remains workable when auth token is not configured

## Notes for Next Planning/Execution Commands

- Phase 01 decision work is complete and the repo-path blocker is resolved
- Phase 02 planning can proceed immediately without reopening the above decisions
