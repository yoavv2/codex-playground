---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: unknown
last_updated: "2026-03-05T09:00:00Z"
progress:
  total_phases: 9
  completed_phases: 6
  total_plans: 21
  completed_plans: 19
---

# STATE

## Project Metadata

- Project: Farfield Mobile Remote Controller (Expo)
- Workflow Mode: yolo
- Created: 2026-02-26T16:59:33Z
- Last Updated: 2026-03-05T09:00:00Z
- Git Branch: codex/phase-08
- Current Milestone: Milestone 3 - Live Sync, Modes, and Personal Deployment
- Current Phase: 08 - UX Polish and Platform Readiness
- Progress: 6 / 9 phases complete (67%) — Phase 08 in progress (3 plans, 2 summaries), manual UAT pending

## Current Position

- Status: Phase 08 implementation is underway — thread detail markdown/code rendering, copy actions, and approval approve/deny controls are shipped (08-01), plus Local/Tailscale preset profile switching with migration-safe storage and Connection-tab active-profile diagnostics (08-02). Phase 08 closeout now depends on manual iOS/Android UAT execution (08-03 checkpoint).
- Next Action: Run `.planning/phases/08-ux-polish-and-platform-readiness/08-UAT.md` matrix on iOS and Android, then close 08-03 summary/state updates.
- Blocking Issues: none
- Active Plan File: .planning/phases/08-ux-polish-and-platform-readiness/08-03-PLAN.md (checkpoint pending)
- Active Summary File: .planning/phases/08-ux-polish-and-platform-readiness/08-02-SUMMARY.md

## Roadmap Snapshot

| Phase | Name | Milestone | Status | Plan Count | Summary Count |
| --- | --- | --- | --- | --- | --- |
| 01 | Prep and Decisions | Milestone 1 | DONE | 1 | 1 |
| 02 | Harden Farfield for Remote Mobile Access | Milestone 1 | DONE | 2 | 2 |
| 03 | Create Expo App Skeleton | Milestone 2 | DONE | 3 | 3 |
| 04 | Build Typed Mobile API Client | Milestone 2 | DONE | 3 | 3 |
| 05 | MVP UI - Threads and Chat | Milestone 2 | IN_PROGRESS | 2 | 2 |
| 06 | Live Updates (SSE) and Reconnect Behavior | Milestone 3 | DONE | 3 | 3 |
| 07 | Collaboration Mode + User Input Requests | Milestone 3 | DONE | 3 | 3 |
| 08 | UX Polish and Platform Readiness | Milestone 3 | IN_PROGRESS | 3 | 2 |
| 09 | Deployment and Ops (Personal Use) | Milestone 3 | TODO | 0 | 0 |

## Confirmed Decisions

- Mobile app is a remote controller for Codex on the Mac; Codex does not run on the phone.
- Mobile app will communicate with Farfield via HTTP + SSE APIs.
- Security hardening is required before real remote use.
- Codex approval prompt support (command/file/apply-patch) is MVP-blocking for practical remote usage.
- Preferred remote access path is Tailscale; confirmed for MVP/personal use in Phase 01.
- Repo strategy is Option A (Farfield fork + `apps/mobile`).
- Local Farfield target repo is `/Users/yoavhevroni/Documents/dev/codex-playground/farfield` on branch `codex/phase-02-remote-hardening`.
- Phase 02 required hardening scope is fixed: bearer token auth, `/events` auth, CORS allowlist, and debug endpoint gating.
- Phase 02 feature branch for hardening work is `codex/phase-02-remote-hardening`.
- `/api/health` remains unauthenticated by default, with opt-in auth via `FARFIELD_REQUIRE_AUTH_FOR_HEALTH=true`.
- Debug API gating defaults to disabled in remote bind mode and enabled in local bind mode unless overridden.
- SSE client package selected in Phase 03 plan 01: **react-native-sse** — supports custom Authorization headers for `/events` auth, pure JS, managed Expo workflow compatible, active maintenance.
- Approval prompt support requires backend/protocol work before/alongside client integration (pending approvals + approve/deny actions).
- Approval exposure strategy is dedicated endpoints, not live-state shape extension.
- Approval contract endpoints are:
  - `GET /api/threads/:id/pending-approvals`
  - `POST /api/threads/:id/pending-approvals/respond`
- Workflow mode is `yolo` unless overridden per command.
- Tab navigator chosen over drawer for Phase 03 screens: three-item set (Connection, Threads, Settings) maps to tab bar; no drawer indirection needed.
- Thread detail route lives outside (tabs) group as a Stack screen for full-screen push navigation from Threads tab.
- `router.push` with template literal used for thread navigation; Expo Router 4 typedRoutes experiment validates at compile time.
- Split storage pattern: authToken stored in expo-secure-store (device-encrypted), non-secrets (serverUrl, profileLabel) in AsyncStorage.
- `@react-native-async-storage/async-storage` v3 API uses `removeMany` (not `multiRemove`).
- `checkHealth()` passes auth token as Bearer header to support opt-in FARFIELD_REQUIRE_AUTH_FOR_HEALTH on the server side.
- `useFocusEffect` used for Connection screen hydration so Settings tab changes are immediately reflected without global state management.
- `fetchJson()` loads settings on every call (no singleton) for simplicity; react-query caches at the hook layer above.
- QueryClient defaults: staleTime 30s, gcTime 5m, retry 2, refetchOnWindowFocus false — conservative for remote-control usage.
- `queryKeys` factory uses const-as pattern for type-safe invalidation surface across all domain queries.
- Metro config kept minimal: only watchFolders and nodeModulesPaths — no custom resolver transforms needed for @farfield/protocol.
- `ZodType<T>` used instead of `ZodSchema<T>` in fetchJson() schema param — ZodSchema checks both _input and _output types causing TS2322 with passthrough/discriminated-union schemas from @farfield/protocol.
- Flat `z.object()` for server response envelopes instead of ZodIntersection (.and()) — intersection type variance breaks with complex nested schemas.
- Mutation hooks own cache invalidation; UI code never calls queryClient directly for write-side concerns.
- SSE auth uses Authorization: Bearer header only; no query-param fallback since react-native-sse sends custom headers on all supported platforms.
- Reconnect policy deferred to Phase 06; subscribeEvents() relies on server-driven retry:1000.
- `handlersRef` pattern in useFarfieldEvents keeps useEffect stable while allowing handler updates without re-subscribing.
- `isFirstLoad` = `query.isLoading && !query.data` (true only before first successful fetch); `isRefreshing` = `query.isFetching && !query.isLoading` (background/manual refetch with existing data) — use isFirstLoad for full-screen spinner gating, isRefreshing for RefreshControl.
- Connection banner on Threads tab uses only REST-derived query state (typed FarfieldClientError instanceof checks); Phase 06 owns SSE/live connection lifecycle and reconnect banner states.
- Thread list search filter matches title, id, and preview; empty states split between no-threads-on-server and no-results-for-filter.
- Thread source badge defaults to 'codex' when source field is absent.
- isRefreshing in useThread: isFetching && \!isLoading — background refetches from cache invalidation do not trigger full-screen loading gate; distinct from isLoading (initial load only).
- ListItem discriminated union defined at module scope in thread detail screen — required to satisfy useRef<FlatList<ListItem>> TypeScript generic constraint; local type declaration inside function body cannot be referenced at hook call site.
- Thread detail Composer: draft cleared on mutation success; scrollToEnd called via FlatList ref after successful send.
- SSE reconnect policy fully owned by useSseConnection(); pollingInterval:0 disables react-native-sse library retry so hook controls backoff exclusively.
- routeEvent() pure classifier maps /events payloads to SyncIntents; only stage=success action events trigger invalidation to avoid premature-refetch noise.
- Per-domain debounce windows: thread-list 800ms, thread-detail 400ms (per-thread Map), approvals 300ms (per-thread Map), collab-mode 800ms — urgency-ordered to balance freshness vs refetch frequency.
- REST errors always surface first in Threads banner deriveConnectionStatus(); SSE status (live-connected/reconnecting/error) layered on top when REST succeeds.
- Reconnecting banner label includes countdown driven by retryAt (ticks per second); idle status renders null on all three live-status surfaces.
- Thread-detail uses compact chip; Connection tab uses full-width row — same color vocabulary (#34C759 live, #FF9500 reconnecting/disconnected, #8E8E93 paused/connecting, #FF3B30 terminal error).
- "Pull to refresh" copy always included in actionable fallback copy when SSE is not connected.
- useLiveUpdates.ts is a thin stable re-export module; screens import from it rather than from LiveUpdatesProvider directly.
- useSseConnection() backoff: base 1s, max 30s, 25% jitter, MAX_RETRIES=8; status=error after limit reached.
- AppState pause in useSseConnection() cancels retry timers and closes socket; resumes immediately on foreground (retryCount preserved across pause/resume, resets only on successful connect).
- saveSettingsAndNotify() wraps saveSettings() with listener fan-out; Settings screen should adopt it (Phase 06-02) so URL/token edits trigger SSE reconnect without app restart.
- LiveUpdatesProvider positioned inside QueryClientProvider in app root so Phase 06-02 invalidation can use both query client and SSE context together.
- `queryKeys.liveState` added as a first-class query domain; thread-detail SSE intents now invalidate both `threads.detail` and `liveState.forThread`.
- `GET /api/threads/:id/live-state` is the source for pending request_user_input prompts; pending prompts are filtered from `conversationState.requests` by method `item/tool/requestUserInput` and `completed=false`.
- Collaboration mode presets are consumed from `GET /api/collaboration-modes` and applied via `POST /api/threads/:id/collaboration-mode` using server-provided preset fields (mode/model/reasoning/developer_instructions).
- `POST /api/threads/:id/user-input` mutation is wired in mobile (`useSubmitUserInput`) and invalidates both thread detail and live-state for the same thread.
- Thread detail screen now includes three control surfaces in one route: collaboration mode selector, pending user-input prompt cards, and existing approval visibility.
- Thread detail turn rendering now uses `MessageMarkdown` with markdown/fenced-code support and explicit copy actions via `expo-clipboard`.
- Pending approval cards now support approve/deny actions from mobile through `useRespondToApproval()` with per-request pending/error feedback.
- Settings persistence now supports two preset profiles (`local`, `tailscale`) with migration from the legacy single-profile keys and active-profile switching in UI.

## Pending Decisions (Current)

- None blocking Phase 08 implementation.

## Deferred Decisions (Intentional)

- Whether to add remote-mode rate limiting and sensitive-log redaction in the first Phase 02 pass
  - Owner phase: 02 Harden Farfield for Remote Mobile Access
  - Criteria: implementation cost vs risk reduction after core auth/CORS/debug gating lands

## Constraints and Guardrails

- Do not expose Farfield to the public internet without auth and network controls.
- Protect `/api/*` and `/events` before remote phone usage.
- Prefer Tailscale over port forwarding.
- Debug endpoints should be disabled by default for remote mode.
- Maintain local/dev behavior when no auth token is configured (per project brief).

## Risks and Watch Items

- Farfield API changes may break the mobile client contract.
- Manual iOS + Android UAT execution is still required to formally close Phase 08.
- React Native SSE libraries may have platform quirks.
- Metro bundling may resist shared protocol package reuse — add `watchFolders` to `metro.config.js` when adding `@farfield/protocol` as a dep in Phase 04.
- Security mistakes in remote mode could expose sensitive debug/history endpoints.

## Issues / Deferred Work

- No `ISSUES.md` yet.
- Do not defer approval prompt support (command/file/apply-patch) beyond MVP if the app is intended for real remote Codex use.
- Defer nice-to-have features until MVP phases complete (model selection, push notifications, advanced debug tooling).

## Session Continuity

- `.continue-here` present: no
- Current in-progress task: Execute and record `08-UAT.md` manual matrix for 08-03 checkpoint
- Stopped At: Completed 08-01 and 08-02 implementation; awaiting human verify checkpoint
- Resume command: `/gsd:progress`

## Recent Work

- 2026-02-26: `/gsd:new-project` initialized `.planning/PROJECT.md` and `.planning/config.json` (`705f1f1`).
- 2026-02-26: `/gsd:create-roadmap` created `ROADMAP.md`, `STATE.md`, and phase directories.
- 2026-02-26: Planning docs updated after deleting standalone plan file; `.planning/PROJECT.md` remains canonical and approval prompt support was marked MVP-blocking.
- 2026-02-26: `/gsd:create-roadmap` replace run regenerated `ROADMAP.md`/`STATE.md` from the updated `.planning/PROJECT.md` and restored phase directories.
- 2026-02-26: Executed `.planning/phases/01-prep-and-decisions/01-01-PLAN.md` in `--yolo` mode; documented Phase 01 decisions and Phase 02 handoff, but recorded a blocker for missing local Farfield repo/fork path.
- 2026-02-26: Cloned `https://github.com/achimala/farfield` to `/Users/yoavhevroni/Documents/dev/farfield` (`main`), validated server/protocol layout, and resolved the Phase 01 blocker.
- 2026-02-27: Moved local Farfield repo to `/Users/yoavhevroni/Documents/dev/codex-playground/farfield`.
- 2026-02-27: Executed `.planning/phases/02-harden-farfield-for-remote-mobile-access/02-01-PLAN.md` in `--yolo` mode; implemented auth/CORS/debug hardening in Farfield, added tests/docs, and recorded verification outcomes in `02-CONTEXT.md`.
- 2026-02-27: Executed `.planning/phases/02-harden-farfield-for-remote-mobile-access/02-02-PLAN.md` in `--yolo` mode; added pending approval APIs, approval response plumbing, tests, and mobile contract docs.
- 2026-02-27: Replanned Phase 03 into three execution plans:
  - `03-01-PLAN.md` foundation + decision lock
  - `03-02-PLAN.md` navigation shell and screen skeletons
  - `03-03-PLAN.md` persisted connection settings + `/api/health` check + docs handoff
- 2026-02-27: Executed `03-01-PLAN.md` — scaffolded `farfield/apps/mobile` as Expo SDK 53 + Expo Router workspace package; locked SSE library as `react-native-sse`; typecheck and lint pass; Metro starts in offline mode (`936330d`, `272ff65`).
- 2026-02-27: Executed `03-02-PLAN.md` — built Expo Router tab navigator (Connection/Threads/Settings) with Thread Detail stack screen; all four Phase 03 screens reachable; typecheck/lint/Metro all pass (`a3e9637`, `2c6fed9`).
- 2026-02-27: Executed `03-03-PLAN.md` — typed ConnectionSettings model, SecureStore/AsyncStorage persistence, Settings screen with TextInput fields and save feedback, Connection screen with /api/health Test Connection button and color-coded status; typecheck/lint/Metro all pass (`ea5a369`, `200a365`, `c4e4bfb`). Phase 03 complete.
- 2026-03-04: Executed `04-01-PLAN.md` — added @tanstack/react-query and @farfield/protocol workspace deps; created metro.config.js with watchFolders for monorepo resolution; built fetchJson() transport with typed error hierarchy; wrapped app root in QueryClientProvider; added queryKeys factory for threads/approvals/agents/collaborationModes/health; typecheck/lint/Metro all pass (`8bbcaec`, `2285e36`, `7a937e2`).
- 2026-03-04: Executed `04-02-PLAN.md` — built read-side API modules (threads, approvals, agents, collaboration) with Zod envelope validation; created useThreads() and useThread() TanStack Query hooks; replaced Phase 03 placeholder thread UI with live data; typecheck/lint/Metro all pass (`5aaed58`, `25670e5`, `8afee6f`).
- 2026-03-04: Executed `04-03-PLAN.md` — implemented write-side client modules (messages.ts, thread-actions.ts), TanStack Query mutation hooks with cache invalidation (useThreadMutations.ts), and SSE subscription primitive (events.ts, useFarfieldEvents.ts); fixed ZodSchema<T>/ZodIntersection type bugs from 04-02 read-side modules; typecheck/lint pass (`5aaed58`, `70041da`, `e08d607`). Phase 04 complete.
- 2026-03-04: Executed `05-01-PLAN.md` — upgraded Threads tab to MVP browse surface with local search/filter (title/id/preview), updatedAt-sorted list, non-blocking pull-to-refresh (isFirstLoad/isRefreshing distinction in useThreads), source badges, split empty states, and REST-derived connection banner (5 status variants); typecheck/lint/Metro all pass (`3f15b1a`, `642daa7`).
- 2026-03-04: Executed `05-02-PLAN.md` — converted thread detail to MVP chat surface: useThread gains isRefreshing/isLoading distinction; FlatList+RefreshControl+KeyboardAvoidingView layout; user/agent turn bubble differentiation; Composer with useSendMessage, trim guard, pending disable, draft-clear on success, inline error feedback; typecheck/lint/expo-export all pass (`50f2a4a`, `2b2d568`).
- 2026-03-05: Executed `06-01-PLAN.md` — SSE reconnect foundation: typed FarfieldStatePayload/FarfieldHistoryPayload + EventSourceConfig passthrough in events.ts; useSseConnection() with 6-state machine (idle/connecting/connected/reconnecting/paused/error), capped exponential backoff (1s-30s, 25% jitter, 8 retries), AppState pause/resume, retryAt metadata; LiveUpdatesProvider + useLiveUpdates() context in app root; subscribeSettingsChanges() + saveSettingsAndNotify() in storage.ts; typecheck/lint/expo-export all pass (`38e227b`, `ec5fa54`, `07002b1`).
- 2026-03-05: Executed `06-02-PLAN.md` — SSE query invalidation wiring: routeEvent() pure classifier (event-routing.ts) maps /events payloads to SyncIntents; LiveUpdatesProvider extended with per-domain debounce timer Maps (list 800ms, detail 400ms per-thread, approvals 300ms per-thread, collab 800ms) invalidating queryClient keys via useQueryClient(); useLiveUpdates.ts stable re-export module; Settings screen migrated to saveSettingsAndNotify(); Threads connection banner augmented with live SSE status (live-connected/live-reconnecting/live-error); typecheck/lint/expo-export all pass (`e981503`, `ca6909e`, `c2c55ac`).
- 2026-03-05: Executed `07-01-PLAN.md` — added typed live-state API module (`live-state.ts`), pending request_user_input extraction helpers, `queryKeys.liveState`, `submitUserInput` mutation transport/hook, and dedicated read hooks (`useThreadLiveState`, `useCollaborationModes`); typecheck/lint pass.
- 2026-03-05: Executed `07-02/07-03` — thread detail now includes collaboration mode selector (server presets + mutation feedback) and pending request_user_input cards with per-question answer capture + submit; LiveUpdatesProvider invalidates live-state with thread-detail intents; typecheck/lint/start checks pass.
- 2026-03-05: Executed `08-01-PLAN.md` — added markdown/code rendering (`MessageMarkdown`), copy actions via `expo-clipboard`, and actionable approval approve/deny cards in thread detail (`ApprovalActionCard` + `useRespondToApproval`); typecheck/lint/start checks pass.
- 2026-03-05: Executed `08-02-PLAN.md` — implemented Local/Tailscale preset profile model, migration-safe storage APIs, Settings preset switcher, and Connection tab active-profile diagnostics; typecheck/lint/start checks pass.
- 2026-03-05: Created Phase 08 planning artifacts (`08-01/08-02/08-03 PLAN`, `08-01/08-02 SUMMARY`, `08-UAT`) and moved Phase 08 roadmap status to IN_PROGRESS pending manual checkpoint.

## Notes for Future Commands

- Source brief phase numbering (0-8) was remapped to GSD phase numbering (01-09).
- Use `.planning/PROJECT.md` as canonical project brief.
- Standalone `FARFIELD_EXPO_MOBILE_APP_PLAN.md` was deleted; use `.planning/PROJECT.md` in new sessions.
- Farfield implementation target for Phase 03+: `/Users/yoavhevroni/Documents/dev/codex-playground/farfield`.
- Active Farfield branch: `codex/phase-02-remote-hardening`.
- Phase 04 entry point: `src/settings/loadSettings()` provides serverUrl+authToken; `src/api/` is the module home for API functions; thread screen skeletons have Phase 04 integration annotations.
- Phase 04 plan 01 complete: `src/api/client.ts` (fetchJson), `src/api/errors.ts` (typed errors), `src/api/queryKeys.ts` (key factory), `app/_layout.tsx` (QueryClientProvider), `metro.config.js` (workspace Metro config).
- Phase 04 complete (plans 01-03): full client surface ready for Phase 05. Read-side: threads.ts, agents.ts, approvals.ts, collaboration.ts + useThreads/useThread hooks. Write-side: messages.ts, thread-actions.ts + useThreadMutations.ts. SSE: events.ts + useFarfieldEvents.ts.
- Phase 05 entry point: import mutation hooks from `src/hooks/useThreadMutations`, SSE hook from `src/hooks/useFarfieldEvents`, read hooks from `src/hooks/useThreads` and `src/hooks/useApprovals`.
- Phase 05 plan 01 complete: `useThreads` now exports `sortedThreads`, `isFirstLoad`, `isRefreshing`. Threads tab has local search, source badge, split empty states, connection banner. Connection banner uses only REST-derived state; Phase 06 adds SSE/reconnect states.
- Phase 05 plan 02 complete: `useThread` now exports `isRefreshing` (background-safe refetch indicator). Thread detail rebuilt as chat surface: FlatList+RefreshControl, user/agent turn bubbles, KeyboardAvoidingView, Composer with draft/send/error state backed by `useSendMessage`.
- Phase 06 entry point: `src/live/LiveUpdatesProvider.tsx` exposes `useLiveUpdates()` for connection state; `src/hooks/useSseConnection.ts` for direct SSE lifecycle; `src/settings/storage.ts` exports `saveSettingsAndNotify()` for reconnect-triggering saves.
- Phase 06 plan 01 complete: events.ts typed transport + EventSourceConfig passthrough; useSseConnection() 6-state machine with backoff/AppState; LiveUpdatesProvider context in app root; settings subscription mechanism.
- Phase 06-02 complete: event-routing.ts pure classifier; LiveUpdatesProvider with debounced invalidation; useLiveUpdates.ts re-export; Settings uses saveSettingsAndNotify(); Threads banner shows SSE live status.
- Phase 06 entry point for plan 03+: src/live/event-routing.ts (routeEvent + SyncIntent types); src/live/useLiveUpdates.ts (connection state hook); src/live/LiveUpdatesProvider.tsx (debounced invalidation handler).
- Phase 06 plan 03 complete: Threads banner enhanced with retryAt countdown (setInterval clears on non-reconnecting); LiveSyncChip added to thread detail header card; LiveTransportRow added to Connection tab for runtime SSE health visibility. typecheck/lint pass (`e66ebed`, `6df4827`).
- Phase 07 entry points: `src/api/live-state.ts`, `src/hooks/useThreadLiveState.ts`, `src/hooks/useCollaborationModes.ts`, and `useSubmitUserInput()` in `src/hooks/useThreadMutations.ts`.
- Thread detail now owns collaboration/user-input controls: `app/thread/[threadId].tsx` renders mode presets, pending request_user_input cards, and submission flows; pull-to-refresh fans out to thread/live-state/mode queries.
