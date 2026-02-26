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

### Blocked on Missing Input

- Exact local Farfield repo/fork path and preferred branch for implementation

## Confirmed Decisions

### Repo Strategy

- **Chosen default:** Option A (Farfield fork + `apps/mobile`)
- Rationale:
  - keeps backend hardening and mobile client work in one repo
  - enables easier reuse of shared protocol definitions
  - reduces version drift between API and app
- Caveat:
  - cannot validate monorepo fit until a local Farfield repo/fork path is available

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

### Blocker 1: Missing Local Farfield Repo/Fork Path

Status:
- Active

What is missing:
- local filesystem path to the Farfield repo/fork to modify
- preferred branch (or confirmation to create one)

Why it blocks:
- Phase 02 implementation planning/execution requires inspecting actual server entrypoints, route wiring, and protocol shape

What will unblock it:
- Provide a local path (for example `/path/to/farfield`) and target branch/fork choice

## Repo Readiness Notes (Discovery)

Discovery performed:
- searched `/Users/yoavhevroni/Documents/dev` (depth 3) for directories matching `farfield`
- searched `/Users/yoavhevroni` (depth 4) for directories matching `*farfield*`

Result:
- no local Farfield repo/fork was found in the searched locations

Validation status:
- monorepo layout and exact server file locations could not be confirmed yet
- Phase 02 remains blocked on repo path/fork availability

## Phase 02 Handoff Notes

When the Farfield repo path is available, Phase 02 should start with:

1. Locate server entrypoint and auth/cors/debug route handling (`/api/*`, `/events`, `/api/debug/*`)
2. Implement token auth middleware with local-dev fallback when no token is configured
3. Protect `/events` with the same auth policy (query token fallback only if SSE client compatibility requires it)
4. Add remote-mode CORS allowlist env (`FARFIELD_ALLOWED_ORIGINS`)
5. Gate debug endpoints with `FARFIELD_ENABLE_DEBUG_API` (default disabled in remote mode)
6. Define approval prompt API shape (pending approvals + approve/deny) if not already present in live-state/protocol
7. Document safe Tailscale-based startup and env usage

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

- Phase 01 decision work is complete except for repo path/fork availability
- Once unblocked, Phase 02 planning can proceed immediately without reopening the above decisions
