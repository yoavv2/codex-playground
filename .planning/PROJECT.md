# Farfield Mobile (Expo) Plan

## Goal

Build a React Native app with Expo (iPhone + Android) that remotely controls the Codex app running on a Mac through a Farfield server on that Mac.

## Core Architecture (Target)

- Phone app (Expo / React Native)
- Secure network path to Mac (recommended: Tailscale)
- Farfield server running on Mac
- Farfield server connects locally to Codex desktop app + app-server + IPC

## Important Constraint

The mobile app will be a remote controller for Codex on the Mac.

- Codex runs on the Mac
- The phone app does not run Codex locally
- The phone app talks to Farfield HTTP + SSE APIs

## Security Requirement (Must Do Before Real Remote Use)

Farfield currently supports remote mode with no authentication. Before using from a phone over any network, add authentication and tighten exposure.

Minimum hardening for MVP:

- Bearer token auth for all `/api/*` endpoints and `/events`
- CORS allowlist (not `*`) for remote mode
- Optional: disable `/api/debug/*` endpoints unless explicitly enabled
- Prefer access over Tailscale; avoid public internet exposure / port forwarding

## Product Scope (MVP)

### In Scope

- Configure server URL + auth token
- Health check / connection status
- List threads
- Read thread conversation
- Send message to thread
- Interrupt thread
- Switch collaboration mode (`default` / `plan`)
- Live updates (SSE with reconnect)
- Basic thread refresh and pull-to-refresh

### Nice to Have (Post-MVP)

- Model selection / model list
- Pending user-input prompts UI
- Stream-events debug screen
- Trace/replay tools (likely admin-only)
- Push notifications
- Markdown/code rendering polish
- Multiple Farfield servers / profiles

### Out of Scope (Initial)

- Running Codex directly on phone
- Public internet exposure without VPN/tunnel/auth
- Full parity with Farfield web debug tooling

## Recommended Repo Strategy

### Option A (Recommended): Fork Farfield and Add `apps/mobile`

Why:

- Reuse existing protocol schemas (`@farfield/protocol`)
- Keep mobile + backend changes in one repo
- Easier version sync between API and app

Proposed structure:

- `apps/server` (existing Farfield backend, hardened)
- `apps/web` (existing Farfield web)
- `apps/mobile` (new Expo app)
- `packages/protocol` (existing shared protocol types/schemas)
- `packages/mobile-client` (optional typed API client for RN)

### Option B: Separate Mobile Repo + Farfield Fork

Use if you want cleaner app-only development.

- `farfield` fork for backend hardening
- separate Expo repo for mobile app

Tradeoff:

- more release coordination
- duplicated API typing unless extracted shared client package

## Implementation Phases

## Phase 0: Prep and Decisions

### Deliverables

- Farfield fork created (or local branch)
- Decide repo structure (Option A vs B)
- Decide transport path (Tailscale strongly recommended)

### Decisions to lock

- App framework: Expo (TypeScript)
- Routing: Expo Router
- State/data: TanStack Query + small local state store
- Auth storage: `expo-secure-store`
- Live updates: SSE (`react-native-sse` or equivalent RN-compatible EventSource)
- Network path for remote access: Tailscale

### Acceptance Criteria

- You can start Farfield locally on Mac
- You can access Farfield on Mac browser
- You have a chosen remote path plan (Tailscale)

## Phase 1: Harden Farfield for Remote Mobile Access

### Backend changes (Farfield server)

Add auth middleware in `apps/server/src/index.ts`:

- Read `FARFIELD_AUTH_TOKEN` from env
- If set, require `Authorization: Bearer <token>` for `/api/*`
- Protect `/events` as well
- Support token via query param for SSE only if needed (for compatibility), e.g. `?access_token=...`
- Reject unauthorized with `401`

Add CORS controls:

- Default local mode can remain permissive
- Remote mode should use allowlist from env, e.g. `FARFIELD_ALLOWED_ORIGINS`
- Return only necessary headers/methods

Add debug gating:

- Add env `FARFIELD_ENABLE_DEBUG_API=false` by default in remote mode
- Block `/api/debug/*` unless enabled

Optional but recommended:

- redact sensitive logs (tokens, payloads if needed)
- add simple rate limiting (per-IP) for remote mode

### CLI / docs updates

- Document `FARFIELD_AUTH_TOKEN`
- Document Tailscale usage
- Document safe remote startup examples

### Acceptance Criteria

- Requests without token fail (`401`)
- Requests with correct token succeed
- `/events` requires auth
- `/api/debug/*` disabled by default in remote mode

## Phase 2: Create Expo App Skeleton

### Bootstrap

Create app in `apps/mobile` (or separate repo):

- Expo + TypeScript
- Expo Router
- ESLint/Prettier (team preference)

Suggested packages:

- `expo-router`
- `@tanstack/react-query`
- `zod`
- `expo-secure-store`
- `react-native-sse` (or chosen SSE lib)
- `@react-native-async-storage/async-storage`
- `react-native-safe-area-context`
- `react-native-gesture-handler`
- `react-native-reanimated`

### App shell screens (initial)

- `Connection` screen (server URL + token + test connection)
- `Threads` screen
- `Thread Detail` screen
- `Settings` screen

### Acceptance Criteria

- App runs on iOS simulator and Android emulator/device
- Navigation works
- Connection settings persist locally

## Phase 3: Build Typed Mobile API Client

### API surface to support first

- `GET /api/health`
- `GET /api/agents`
- `GET /api/threads`
- `GET /api/threads/:threadId`
- `POST /api/threads/:threadId/messages`
- `POST /api/threads/:threadId/interrupt`
- `GET /api/collaboration-modes`
- `POST /api/threads/:threadId/collaboration-mode`
- `GET /events` (SSE)

### Client design

- `FarfieldClient` with:
  - `baseUrl`
  - `token`
  - `fetchJson()`
  - `subscribeEvents()`

Use runtime validation with `zod` for responses:

- Reuse `@farfield/protocol` where possible
- If Metro has issues bundling shared package, create mobile-specific schemas package

### Error handling

- Unauthorized
- Network unreachable
- Server unavailable
- Validation mismatch
- Timeouts / retries

### Acceptance Criteria

- Connection test returns health state
- Thread list and thread detail fetch from real Farfield instance
- Token auth works end-to-end

## Phase 4: MVP UI - Threads and Chat

### Threads Screen

- List threads (sorted by updated time)
- Pull to refresh
- Search/filter (basic local text filter)
- Agent badge (`codex`, later `opencode`)
- Connection banner (connected / reconnecting / auth failed)

### Thread Detail Screen

- Conversation view (messages/turns)
- Composer to send message
- Loading and send state
- Manual refresh
- Interrupt button

### Basic rendering strategy

Start simple:

- plain text rendering for message content
- code blocks as monospaced text

Later:

- markdown renderer
- syntax highlighting

### Acceptance Criteria

- Can open a thread and read content
- Can send a message from phone and see it arrive in Codex/Farfield
- Can interrupt a running thread

## Phase 5: Live Updates (SSE) and Reconnect Behavior

### SSE integration

Subscribe to `/events`:

- update connection state
- react to history / message events
- refresh active thread on relevant events
- debounce thread detail refresh to avoid excessive calls

### Reconnect behavior

- exponential backoff reconnect
- foreground/background awareness (AppState)
- network change awareness (NetInfo optional)

### Data sync approach (recommended)

Use SSE as a trigger, not the source of truth:

- keep canonical state from REST endpoints
- on event, invalidate/refetch affected queries

This is simpler and more reliable than reconstructing all state from events on mobile.

### Acceptance Criteria

- App reconnects automatically after temporary network loss
- Active thread updates while Codex is running on Mac
- UI remains usable when SSE disconnects (manual refresh fallback)

## Phase 6: Collaboration Mode + User Input Requests

### Collaboration mode

- Fetch modes (`GET /api/collaboration-modes`)
- Apply mode (`POST /api/threads/:id/collaboration-mode`)
- Show current mode in thread header

### Pending user-input requests (MVP+)

- Read thread live state (`GET /api/threads/:id/live-state`)
- Render pending user input prompts if present
- Submit response (`POST /api/threads/:id/user-input`)

### Acceptance Criteria

- Can switch `default`/`plan` from phone
- Can answer a pending user-input request from phone (if present)

## Phase 7: UX Polish and Platform Readiness

### UX improvements

- Better message rendering (markdown, code blocks)
- Optimistic composer UX
- Empty states and error states
- Connection profile switching (Local / Tailscale)
- Clipboard actions (copy message/code)

### Platform work

- iOS + Android testing pass
- Deep link support for opening specific thread (optional)
- Icon / splash / app name

### Acceptance Criteria

- Stable on both platforms for normal usage
- No critical crashes in thread browse/chat flows

## Phase 8: Deployment and Ops (Personal Use)

### Mac-side runtime

Safe startup patterns:

- run Farfield on Mac when needed
- bind to `0.0.0.0` only when using phone remotely
- use Tailscale IP
- keep strong token in env

### App distribution

- Expo dev builds for personal testing
- EAS Build for installable iOS/Android builds later

### Acceptance Criteria

- Phone app can connect over Tailscale to Mac
- Remote session can read/send/interrupt reliably

## API and Backend Work Items (Concrete)

## A. Auth Middleware (Farfield)

### Proposed env vars

- `FARFIELD_AUTH_TOKEN`
- `FARFIELD_ALLOWED_ORIGINS`
- `FARFIELD_ENABLE_DEBUG_API`
- `FARFIELD_REQUIRE_AUTH_FOR_HEALTH` (optional)

### Behavior

- If token is absent: local/dev behavior (existing behavior)
- If token is present: require auth for all high-privilege endpoints
- For `/events`, accept:
  - `Authorization: Bearer ...`
  - optionally `access_token` query param (SSE compatibility fallback)

## B. CORS tightening

### Remote mode behavior

- No wildcard origins
- Allow only configured origins (web UI domain/app wrapper if needed)
- Since native apps are not browser-limited the same way, CORS matters mostly for browser clients; still tighten for safety

## C. Debug endpoint gating

Block by default remotely:

- `/api/debug/history`
- `/api/debug/replay`
- `/api/debug/trace/*`

Reason:

- These are powerful and leak internal frames/history

## Mobile App Technical Design (MVP)

## Screens

### 1. Connection / Onboarding

- Server URL input (examples: `http://100.x.y.z:4311`)
- Token input
- Test Connection button
- Save profile

### 2. Threads List

- Thread items
- Pull to refresh
- Status banner
- Navigate to thread detail

### 3. Thread Detail

- Message list
- Composer
- Interrupt button
- Mode picker
- Refresh

### 4. Settings

- Server profile edit
- Toggle auto-refresh / SSE diagnostics
- About / version

## Data layer

- TanStack Query keys:
  - `health`
  - `agents`
  - `threads`
  - `thread:{id}`
  - `threadLiveState:{id}`
  - `collaborationModes`
- Invalidate on SSE events

## State to persist

- server profiles (URL, label)
- selected profile
- token (prefer `expo-secure-store`)
- last opened thread (optional)

## Risks and Mitigations

## Risk 1: Farfield API changes

Mitigation:

- pin Farfield commit in fork
- generate/maintain typed schemas
- add integration tests against real server

## Risk 2: RN SSE library quirks

Mitigation:

- use SSE only as invalidation trigger
- maintain REST polling fallback
- abstract event subscription behind interface

## Risk 3: Security mistakes in remote mode

Mitigation:

- token auth first
- Tailscale only
- no public exposure
- debug endpoints disabled by default

## Risk 4: Metro bundling issues with shared packages

Mitigation:

- keep shared protocol package runtime-safe (no Node imports)
- if needed, copy/minimize schemas into `packages/mobile-client`

## Milestone Plan (Suggested)

## Milestone 1: Secure Farfield Remote API

- Add auth
- Add CORS allowlist
- Disable debug endpoints remotely
- Document safe startup

Result:

- Mobile-ready backend surface

## Milestone 2: Mobile MVP Can Read and Send

- Expo app scaffold
- Connection settings
- Threads list
- Thread detail
- Send message / interrupt

Result:

- Usable remote Codex controller

## Milestone 3: Live Sync + Modes

- SSE reconnect
- Collaboration mode switch
- Better status UX

Result:

- Smooth day-to-day remote usage

## Test Plan

## Backend tests (Farfield)

- auth required/optional paths
- invalid token -> `401`
- valid token -> success
- debug endpoint disabled when env false
- `/events` auth checks

## Mobile tests

- API client unit tests (response parsing)
- connection settings persistence
- threads list rendering
- send message action flow

## Manual integration checks

- iPhone on same network / Tailscale connects
- message sent from phone appears in Codex
- interrupt works
- reconnect after Wi-Fi toggle works

## Suggested Build Order for Next Session

1. Fork Farfield and add backend auth + debug gating
2. Verify remote access over Tailscale with curl
3. Scaffold Expo app (`apps/mobile`)
4. Build connection screen + typed client
5. Implement threads list + thread detail
6. Implement send + interrupt
7. Add SSE live refresh
8. Polish and test on iPhone + Android

## New Session Kickoff Prompt (Copy/Paste)

```md
We are building a React Native app with Expo (iPhone + Android) that remotely controls Codex on my Mac through Farfield.

Please follow the plan in `/Users/yoavhevroni/Documents/dev/codex-playground/FARFIELD_EXPO_MOBILE_APP_PLAN.md`.

Start with Milestone 1:
- harden Farfield for remote use (Bearer token auth, `/events` auth, debug endpoint gating, CORS allowlist)
- keep current local behavior working when no token is configured
- add docs for safe Tailscale-based remote usage

Then verify with curl commands.
```

## Notes From Current Session (Useful Context)

- Farfield backend and web can run locally and connect to Codex successfully on this Mac.
- Current Farfield remote mode is unauthenticated by design; do not expose it publicly.
- `bun` version on this machine was `1.1.36`, which caused recursive workspace build issues with `bun run build`; targeted per-package builds worked.

