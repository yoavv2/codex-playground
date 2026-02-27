# Phase 03 Context: Create Expo App Skeleton

## Phase Goal

Scaffold the mobile app workspace (`farfield/apps/mobile`) inside the existing Farfield monorepo and produce a working Expo + TypeScript package with static checks passing, navigation shell, and persisted connection settings.

Phase 03 is split into three execution plans:

- `03-01`: Expo foundation + decision lock (this plan)
- `03-02`: Navigation shell and screen skeletons
- `03-03`: Persisted connection settings + `/api/health` check UI + docs handoff to Phase 04

## Constraints Inherited from Phase 02

- Transport: Tailscale is the required transport for remote MVP/personal use.
- Auth: `FARFIELD_AUTH_TOKEN` bearer token must be passed on all `/api/*` and `/events` requests.
- `/events` supports `Authorization: Bearer <token>` header and `?access_token=` query parameter.
- `/api/health` is unauthenticated by default (opt-in auth via `FARFIELD_REQUIRE_AUTH_FOR_HEALTH`).
- CORS policy: remote CORS requires `FARFIELD_ALLOWED_ORIGINS` allowlist; local dev permits wildcard.
- Debug API: `/api/debug/*` is disabled by default in remote bind mode.
- Approval APIs are ready on the server side:
  - `GET /api/threads/:id/pending-approvals`
  - `POST /api/threads/:id/pending-approvals/respond`

## Locked Decisions (Phase 03)

### Mobile package location and name

- Path: `farfield/apps/mobile`
- Package name: `@farfield/mobile`
- Workspace: already covered by root `"workspaces": ["apps/*", "packages/*"]`

### App framework and routing

- Framework: **Expo SDK** (TypeScript)
- Routing: **Expo Router** (file-based, `app/` directory)
- Rationale: matches Phase 01 decision; Expo Router is the canonical routing solution for Expo SDK projects and aligns with native navigation conventions.

### State/data layer

- **TanStack Query** (`@tanstack/react-query`) for server state, polling, and cache management.
- Rationale: confirmed in Phase 01 decisions; pairs well with REST polling and future SSE-driven invalidation.

### Auth/token storage

- **`expo-secure-store`** for `FARFIELD_AUTH_TOKEN` (sensitive, device-encrypted).
- **`@react-native-async-storage/async-storage`** for non-secret profile values (server URL, display preferences).
- Rationale: confirmed in Phase 01 decisions; separation of secret vs. non-secret storage is the standard Expo pattern.

### SSE Package Decision (Deferred from Phase 01, resolved here)

**Chosen: `react-native-sse`**

Evaluation table:

| Package | RN/Expo Compat | Reconnect | Auth Headers | Maintenance | Notes |
| --- | --- | --- | --- | --- | --- |
| `react-native-sse` | Excellent | Manual (interval-based wrapper) | YES — custom headers supported | Active (2024 activity) | Pure RN, no native modules needed; custom headers work |
| `expo-modules-core` EventSource | N/A as library | N/A | No header support in stock EventSource | N/A | Stock EventSource does not support auth headers |
| `@microsoft/fetch-event-source` | No — Node fetch API not available in RN | Partial | YES | Good | Uses `fetch` which is available but the reconnect logic and RN stream handling differs |
| `eventsource-parser` + fetch | Works in RN | Manual | YES | Good | Lower-level; requires manual stream loop; viable but more code |

Decision rationale:

- `react-native-sse` is a pure JS EventSource polyfill designed explicitly for React Native.
- It passes custom request headers (required for `Authorization: Bearer <token>`).
- Query parameter fallback (`?access_token=`) is also usable as a safety escape hatch.
- Reconnect control: reconnect can be managed by a wrapper (back-off + manual `.close()` + re-instantiate). This is sufficient for Phase 06 reconnect behavior work.
- No native modules required: works with managed Expo workflow.
- Active maintenance and widely used in RN SSE scenarios.

**`@microsoft/fetch-event-source` is the preferred alternative** if `react-native-sse` presents Metro or Expo SDK compatibility issues in practice. Document any issues found during Phase 06.

## Plan Split Boundaries

### 03-01 (this plan)

Scope:
- Lock decisions (this file)
- Scaffold `farfield/apps/mobile` package (package.json, tsconfig, app.json, babel.config.js, Expo Router entrypoint)
- Validate static toolchain health (typecheck, lint)

Out of scope:
- Navigation shell and screen components
- Persisted settings storage
- `/api/health` check UI

### 03-02

Scope:
- Navigation shell using Expo Router file-based layout
- Screen skeletons: Home/Threads screen, Thread detail screen, Settings screen placeholder
- Tab or stack navigator setup (TBD in 03-02 based on UX preference)
- Placeholder UI components (no real API calls yet)

Out of scope:
- Real API integration
- Persisted settings read/write

### 03-03

Scope:
- Persisted connection settings (server URL + auth token) using `expo-secure-store` + AsyncStorage
- Settings screen that reads/writes stored values
- `/api/health` test UI (ping button + status display)
- Phase 04 handoff documentation

Out of scope:
- Thread list and real data rendering (Phase 04)

## Open Watch Items for Phase 04

- **Metro bundler and workspace packages:** When Phase 04 adds `@farfield/protocol` or `@farfield/api` as a workspace dependency of `@farfield/mobile`, Metro may need `watchFolders` configuration to resolve symlinked workspace packages. Address in Phase 04 scaffold.
- **SSE reconnect behavior:** `react-native-sse` does not have built-in exponential back-off. Phase 06 will implement a reconnect manager wrapping the SSE client.
- **`detail` field parsing:** Approval `detail` fields from the server are JSON strings. Phase 04 UI can parse selected fields for richer rendering; keep them as strings on the transport layer.
- **`@farfield/protocol` Metro symlink:** If `react-native-sse` or Expo Router causes issues with NodeNext module resolution from `tsconfig.base.json`, the mobile package will need its own tsconfig module/resolution override.

## Verification Commands

Run from `farfield/`:

```bash
bun install
bun run --filter @farfield/mobile typecheck
bun run --filter @farfield/mobile lint
```

Run startup sanity check:

```bash
bun run --filter @farfield/mobile start -- --non-interactive --offline
```
