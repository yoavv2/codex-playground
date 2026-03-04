---
phase: "04"
plan: "01"
subsystem: mobile-api-client
tags: [react-query, fetch, transport, authentication, metro, workspace]
dependency_graph:
  requires:
    - "03-03: ConnectionSettings model, loadSettings(), SecureStore/AsyncStorage persistence"
    - "@farfield/protocol workspace package with built dist/"
  provides:
    - "fetchJson() authenticated transport helper"
    - "Typed FarfieldClientError hierarchy"
    - "QueryClientProvider at app root"
    - "Centralized query key factory (queryKeys)"
    - "Metro workspace config for @farfield/protocol imports"
  affects:
    - "Phase 04 plans 02+: all endpoint modules use fetchJson() instead of raw fetch"
    - "Phase 05 UI: TanStack Query hooks use queryKeys for cache invalidation"
tech_stack:
  added:
    - "@tanstack/react-query ^5.80.2"
    - "@farfield/protocol workspace:*"
  patterns:
    - "fetchJson() schema-aware transport with Zod validation"
    - "Typed error class hierarchy for API failures"
    - "QueryClient with conservative remote-control defaults"
    - "Metro watchFolders + nodeModulesPaths for monorepo workspace resolution"
key_files:
  created:
    - farfield/apps/mobile/metro.config.js
    - farfield/apps/mobile/src/api/client.ts
    - farfield/apps/mobile/src/api/errors.ts
    - farfield/apps/mobile/src/api/queryKeys.ts
  modified:
    - farfield/apps/mobile/package.json
    - farfield/apps/mobile/app/_layout.tsx
    - farfield/bun.lockb
decisions:
  - "fetchJson() loads settings on every call (no singleton) for simplicity; Phase 04 hooks will cache via react-query anyway"
  - "QueryClient defaults: staleTime 30s, gcTime 5m, retry 2, refetchOnWindowFocus false — conservative for remote-control usage"
  - "queryKeys factory uses const-as pattern for type-safe invalidation surface"
  - "Metro config kept minimal: only watchFolders and nodeModulesPaths — no custom resolver transforms"
metrics:
  duration: "~20 minutes"
  completed_date: "2026-03-04"
  tasks_completed: 3
  tasks_total: 3
  files_created: 4
  files_modified: 3
---

# Phase 04 Plan 01: Typed Mobile API Client Foundation Summary

Installed @tanstack/react-query and @farfield/protocol workspace dep, created a schema-aware authenticated fetch transport with typed error classes, wired QueryClientProvider at the app root, and added a centralized query-key factory — giving Phase 04 endpoint modules one stable surface for auth, caching, and error handling.

## Tasks Completed

| # | Task | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Install shared client dependencies and make Metro resolve workspace protocol code | 8bbcaec | package.json, metro.config.js, bun.lockb |
| 2 | Create a reusable authenticated Farfield transport layer | 2285e36 | src/api/client.ts, src/api/errors.ts |
| 3 | Wire the root app tree for shared query state and stable cache keys | 7a937e2 | app/_layout.tsx, src/api/queryKeys.ts |

## Verification Results

- [x] `bun install` completes in farfield/ — no lockfile changes
- [x] `bun run --filter @farfield/protocol build` passes — dist/ exports present
- [x] `bun run --filter @farfield/mobile typecheck` passes — 0 errors
- [x] `bun run --filter @farfield/mobile lint` passes — 0 errors
- [x] `bun run --filter @farfield/mobile start -- --non-interactive --offline` starts without Metro resolution errors

## What Was Built

### `src/api/errors.ts` — Typed error hierarchy

Six typed error classes covering all failure modes for Farfield API calls:

- `NoServerUrlError` — user has not configured serverUrl
- `UnauthorizedError` — HTTP 401 or 403 from server
- `ServerUnreachableError` — network/DNS/connection failures
- `RequestTimeoutError` — request exceeded configured timeout
- `HttpError` — non-2xx response (not auth-related)
- `SchemaMismatchError` — Zod schema validation failure on response body

### `src/api/client.ts` — Authenticated transport helper

`fetchJson<T>(path, options)` that:
1. Calls `loadSettings()` to get serverUrl + authToken
2. Throws `NoServerUrlError` if serverUrl is blank
3. Trims trailing slashes from base URL
4. Applies `Authorization: Bearer ...` when authToken is set
5. Enforces configurable timeout (default 10s) via AbortController
6. Maps fetch errors to typed FarfieldClientError subclasses
7. Validates response body with a Zod schema when `options.schema` is provided

### `metro.config.js` — Workspace Metro configuration

Adds `watchFolders: [monorepoRoot]` and `resolver.nodeModulesPaths` with both app-level and workspace-root node_modules, enabling Metro to resolve `@farfield/protocol` from the workspace without extra transforms.

### `app/_layout.tsx` — QueryClientProvider at root

Wraps the Expo Router `Stack` in a single `QueryClientProvider` with conservative defaults:
- `staleTime: 30_000` — data stays fresh for 30s
- `gcTime: 300_000` — inactive cache held for 5 minutes
- `retry: 2` — two retries for transient failures
- `refetchOnWindowFocus: false` — no aggressive refetching on app focus
- `refetchOnReconnect: true` — re-fetches on network restore

### `src/api/queryKeys.ts` — Centralized key factory

Domain-scoped query key factory for: `threads`, `approvals`, `agents`, `collaborationModes`, and `health`. Each domain provides an `all` root for broad invalidation and granular sub-keys for specific queries.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] `farfield/apps/mobile/metro.config.js` — FOUND
- [x] `farfield/apps/mobile/src/api/client.ts` — FOUND
- [x] `farfield/apps/mobile/src/api/errors.ts` — FOUND
- [x] `farfield/apps/mobile/src/api/queryKeys.ts` — FOUND
- [x] Commit 8bbcaec — FOUND
- [x] Commit 2285e36 — FOUND
- [x] Commit 7a937e2 — FOUND

## Self-Check: PASSED
