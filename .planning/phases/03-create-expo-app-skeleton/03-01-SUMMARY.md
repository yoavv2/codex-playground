---
phase: 03-create-expo-app-skeleton
plan: "01"
subsystem: mobile
tags: [expo, react-native, expo-router, typescript, sse, react-native-sse, bun, monorepo]

# Dependency graph
requires:
  - phase: 02-harden-farfield-for-remote-mobile-access
    provides: Auth/CORS/debug hardening and approval APIs that mobile will consume

provides:
  - farfield/apps/mobile workspace package (@farfield/mobile) scaffolded with Expo SDK 53 + TypeScript
  - Phase 03 decision lock in 03-CONTEXT.md (SSE library, routing, storage, plan split)
  - Expo Router file-based routing entrypoint (app/_layout.tsx, app/index.tsx)
  - Static checks passing (typecheck, lint) in workspace filter

affects:
  - 03-02-PLAN.md (navigation shell builds on this scaffold)
  - 03-03-PLAN.md (persisted settings uses expo-secure-store locked here)
  - 04-build-typed-mobile-api-client (react-native-sse locked here; Metro symlink watch item)

# Tech tracking
tech-stack:
  added:
    - expo@53.0.27
    - expo-router@4.0.22
    - react-native@0.76.9
    - react-native-sse@1.2.1 (SSE client, locked decision)
    - expo-status-bar, expo-constants, expo-linking
    - react-native-screens, react-native-safe-area-context, react-native-reanimated
    - babel-preset-expo via @babel/core
  patterns:
    - Expo Router file-based routing (app/ directory, app/_layout.tsx root)
    - Managed Expo workflow (no native ejection)
    - tsconfig extends expo/tsconfig.base (not farfield's NodeNext tsconfig.base.json)
    - Per-package typecheck and lint via bun --filter

key-files:
  created:
    - farfield/apps/mobile/package.json
    - farfield/apps/mobile/tsconfig.json
    - farfield/apps/mobile/babel.config.js
    - farfield/apps/mobile/app.json
    - farfield/apps/mobile/.gitignore
    - farfield/apps/mobile/app/_layout.tsx
    - farfield/apps/mobile/app/index.tsx
    - .planning/phases/03-create-expo-app-skeleton/03-CONTEXT.md
  modified:
    - farfield/.gitignore (added .expo, apps/mobile/.expo, apps/mobile/expo-env.d.ts patterns)

key-decisions:
  - "SSE library locked to react-native-sse - supports custom Authorization headers required by Farfield /events auth"
  - "Mobile tsconfig extends expo/tsconfig.base not farfield NodeNext base - Metro requires different module resolution"
  - "@types/react-native removed - React Native 0.76+ ships bundled types; standalone package only covers up to 0.73"
  - "Expo Router typedRoutes experiment enabled in app.json for type-safe link() calls in later phases"
  - "react-native-sse chosen over @microsoft/fetch-event-source - better RN stream handling and no Node fetch dependency"

patterns-established:
  - "Mobile-only gitignore pattern: nested .gitignore in apps/mobile/ covers .expo/ and expo-env.d.ts (Expo-generated)"
  - "Expo SDK version pin: exact versions (not ^) for expo, expo-router, react-native to match SDK compatibility matrix"

# Metrics
duration: 3min
completed: 2026-02-27
---

# Phase 03 Plan 01: Expo Foundation and Decision Lock Summary

**Expo SDK 53 + Expo Router workspace package scaffolded in farfield/apps/mobile with react-native-sse locked as SSE client for Authorization header support**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-27T19:04:09Z
- **Completed:** 2026-02-27T19:07:56Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- Locked all Phase 03 implementation decisions in `03-CONTEXT.md` including SSE library selection (react-native-sse), routing (Expo Router), and storage (expo-secure-store + AsyncStorage)
- Scaffolded `farfield/apps/mobile` as a full Expo SDK 53 + TypeScript workspace package with file-based routing via Expo Router
- Confirmed static toolchain health: `bun run --filter @farfield/mobile typecheck` and `bun run --filter @farfield/mobile lint` both exit 0; Metro starts in offline mode

## Task Commits

Each task was committed atomically:

1. **Task 1: Lock Phase 03 decisions and create context file** - `936330d` (feat)
2. **Task 2: Scaffold Expo mobile workspace package** - `272ff65` (feat)
3. **Task 3: Validate foundation and record handoff** - _(docs commit below)_

**Plan metadata:** _(final commit)_

## Files Created/Modified

- `farfield/apps/mobile/package.json` - @farfield/mobile workspace package, Expo SDK 53 deps, start/ios/android/web/typecheck/lint scripts
- `farfield/apps/mobile/tsconfig.json` - Extends expo/tsconfig.base with strict mode and @/* path alias
- `farfield/apps/mobile/babel.config.js` - babel-preset-expo config
- `farfield/apps/mobile/app.json` - Expo config with Router plugin, typedRoutes, iOS/Android bundle IDs
- `farfield/apps/mobile/.gitignore` - Expo-generated + .expo/ and node_modules
- `farfield/apps/mobile/app/_layout.tsx` - Expo Router root Stack layout
- `farfield/apps/mobile/app/index.tsx` - Placeholder home screen
- `farfield/.gitignore` - Added mobile build/runtime artifact patterns
- `.planning/phases/03-create-expo-app-skeleton/03-CONTEXT.md` - Full Phase 03 decision lock

## Decisions Made

- **react-native-sse** selected over `@microsoft/fetch-event-source` because it is a purpose-built React Native EventSource polyfill that supports custom request headers (required for `Authorization: Bearer <token>` on `/events`), requires no native modules (managed Expo workflow), and has active maintenance.
- **tsconfig extends expo/tsconfig.base** rather than the workspace's `tsconfig.base.json` because Metro bundler requires `bundler` module resolution (not NodeNext); mixing Node resolution into a Metro project causes build failures.
- **`@types/react-native` removed** from devDependencies because React Native 0.76+ ships TypeScript types bundled in the package itself; the standalone `@types/react-native` package only reaches 0.73.0.
- **Expo Router typedRoutes** enabled via `experiments.typedRoutes: true` in `app.json` so Phase 02 and later phases get type-safe `Link` and `router.push()` calls.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed incompatible @types/react-native version specifier**
- **Found during:** Task 2 (scaffold package.json)
- **Issue:** `@types/react-native` package only exists up to `0.73.0`; specifying `~0.76.0` caused `bun install` to fail with "No version matching"
- **Fix:** Removed `@types/react-native` from devDependencies; RN 0.76+ ships its own types
- **Files modified:** `farfield/apps/mobile/package.json`
- **Verification:** `bun install` succeeds with no version errors; `bun run --filter @farfield/mobile typecheck` exits 0
- **Committed in:** `272ff65` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Required for install to succeed; no scope creep.

## Issues Encountered

- Initial `bun install` failed on `@types/react-native: ~0.76.0` — package max version is 0.73.0. Fixed by dropping the package (React Native 0.76 ships bundled types).
- Expo Metro start modified `tsconfig.json` and `expo-env.d.ts` on first run (added `.expo/types/**/*.ts` include glob) — this is expected Expo behavior; changes were captured.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `03-02` can proceed immediately with Expo Router navigation shell and screen skeletons
- All decisions are locked in `03-CONTEXT.md` — `03-02` and `03-03` can consume without reopening decisions
- **Metro symlink watch item for Phase 04:** When `@farfield/protocol` or `@farfield/api` workspace packages are added as deps of `@farfield/mobile`, Metro may need `watchFolders` in `metro.config.js` to resolve symlinks — address in Phase 04

### 03-02 Handoff Boundary

03-02 should begin with:
1. Add navigation shell using Expo Router file-based layout (tabs or stack)
2. Create screen skeleton files under `app/`: threads list, thread detail, settings placeholder
3. No real API calls or persisted storage — that is 03-03 scope

---
*Phase: 03-create-expo-app-skeleton*
*Completed: 2026-02-27*

## Self-Check: PASSED

All created files verified on disk. Both task commits (936330d, 272ff65) found in git log.
