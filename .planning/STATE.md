# STATE

## Project Metadata

- Project: Farfield Mobile Remote Controller (Expo)
- Workflow Mode: yolo
- Created: 2026-02-26T16:59:33Z
- Last Updated: 2026-03-04T18:09:24Z
- Git Branch: main
- Current Milestone: Milestone 2 - Mobile MVP Can Read, Send, and Approve
- Current Phase: 04 - Build Typed Mobile API Client
- Progress: 3 / 9 phases complete (33%) — Phase 03 complete

## Current Position

- Status: 04-01 complete — fetchJson() authenticated transport, typed FarfieldClientError hierarchy, QueryClientProvider at app root, centralized queryKeys factory, Metro workspace config for @farfield/protocol; typecheck/lint/Metro all pass.
- Next Action: Execute next plan in Phase 04 (endpoint-specific client hooks)
- Blocking Issues: none
- Active Plan File: `.planning/phases/04-build-typed-mobile-api-client/04-01-PLAN.md` (complete)
- Active Summary File: `.planning/phases/04-build-typed-mobile-api-client/04-01-SUMMARY.md`

## Roadmap Snapshot

| Phase | Name | Milestone | Status | Plan Count | Summary Count |
| --- | --- | --- | --- | --- | --- |
| 01 | Prep and Decisions | Milestone 1 | DONE | 1 | 1 |
| 02 | Harden Farfield for Remote Mobile Access | Milestone 1 | DONE | 2 | 2 |
| 03 | Create Expo App Skeleton | Milestone 2 | DONE | 3 | 3 |
| 04 | Build Typed Mobile API Client | Milestone 2 | IN PROGRESS | 1 | 1 |
| 05 | MVP UI - Threads and Chat | Milestone 2 | TODO | 0 | 0 |
| 06 | Live Updates (SSE) and Reconnect Behavior | Milestone 3 | TODO | 0 | 0 |
| 07 | Collaboration Mode + User Input Requests | Milestone 3 | TODO | 0 | 0 |
| 08 | UX Polish and Platform Readiness | Milestone 3 | TODO | 0 | 0 |
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

## Pending Decisions (Current)

- None blocking Phase 04 start.

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
- Mobile client UI integration for pending approvals is not yet implemented (planned for Phase 04).
- React Native SSE libraries may have platform quirks.
- Metro bundling may resist shared protocol package reuse — add `watchFolders` to `metro.config.js` when adding `@farfield/protocol` as a dep in Phase 04.
- Security mistakes in remote mode could expose sensitive debug/history endpoints.

## Issues / Deferred Work

- No `ISSUES.md` yet.
- Do not defer approval prompt support (command/file/apply-patch) beyond MVP if the app is intended for real remote Codex use.
- Defer nice-to-have features until MVP phases complete (model selection, push notifications, advanced debug tooling).

## Session Continuity

- `.continue-here` present: no
- Current in-progress task: none
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

## Notes for Future Commands

- Source brief phase numbering (0-8) was remapped to GSD phase numbering (01-09).
- Use `.planning/PROJECT.md` as canonical project brief.
- Standalone `FARFIELD_EXPO_MOBILE_APP_PLAN.md` was deleted; use `.planning/PROJECT.md` in new sessions.
- Farfield implementation target for Phase 03+: `/Users/yoavhevroni/Documents/dev/codex-playground/farfield`.
- Active Farfield branch: `codex/phase-02-remote-hardening`.
- Phase 04 entry point: `src/settings/loadSettings()` provides serverUrl+authToken; `src/api/` is the module home for API functions; thread screen skeletons have Phase 04 integration annotations.
- Phase 04 plan 01 complete: `src/api/client.ts` (fetchJson), `src/api/errors.ts` (typed errors), `src/api/queryKeys.ts` (key factory), `app/_layout.tsx` (QueryClientProvider), `metro.config.js` (workspace Metro config).
