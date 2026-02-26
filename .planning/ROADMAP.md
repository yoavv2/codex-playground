# ROADMAP

Project: Farfield Mobile Remote Controller (Expo)
Created: 2026-02-26
Workflow Mode: yolo

## Planning Notes

- This roadmap renumbers the source brief's phases (0-8) into GSD phases (01-09).
- Security hardening is front-loaded before real remote mobile usage.
- Preferred repo strategy is Option A (Farfield fork + `apps/mobile`), validated in Phase 01.
- Codex approval prompt support (command/file/apply-patch) is treated as MVP-blocking for remote usability.

## Milestones

### Milestone 1: Secure Remote Foundation (Active)

Goal: Lock decisions and harden Farfield so remote mobile access can be used safely over Tailscale.

Phases:
- 01 Prep and Decisions
- 02 Harden Farfield for Remote Mobile Access

### Milestone 2: Mobile MVP Can Read, Send, and Approve

Goal: Ship an Expo mobile app MVP that can connect, browse threads, read conversations, send messages, interrupt runs, and handle Codex approval prompts.

Phases:
- 03 Create Expo App Skeleton
- 04 Build Typed Mobile API Client
- 05 MVP UI - Threads and Chat

### Milestone 3: Live Sync, Modes, and Personal Deployment

Goal: Add live updates, collaboration controls, UX polish, and personal deployment/ops readiness for day-to-day remote use.

Phases:
- 06 Live Updates (SSE) and Reconnect Behavior
- 07 Collaboration Mode + User Input Requests
- 08 UX Polish and Platform Readiness
- 09 Deployment and Ops (Personal Use)

## Phase Breakdown

| GSD Phase | Source Phase | Status | Plans | Summaries | Research | Phase Name | Goal |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 01 | 0 | DONE | 1 | 1 | No | Prep and Decisions | Lock repo strategy, transport path, and implementation defaults before code changes. |
| 02 | 1 | TODO | 0 | 0 | No | Harden Farfield for Remote Mobile Access | Add auth, CORS tightening, and debug gating for safe remote use. |
| 03 | 2 | TODO | 0 | 0 | Optional | Create Expo App Skeleton | Bootstrap Expo app shell with persistent connection settings and navigation. |
| 04 | 3 | TODO | 0 | 0 | No | Build Typed Mobile API Client | Implement authenticated, validated REST/SSE client for Farfield APIs, including approval prompt endpoints. |
| 05 | 4 | TODO | 0 | 0 | No | MVP UI - Threads and Chat | Build thread list/detail UI with send, interrupt, and approval flows. |
| 06 | 5 | TODO | 0 | 0 | Optional | Live Updates (SSE) and Reconnect Behavior | Add SSE-driven invalidation, reconnect logic, and resilience. |
| 07 | 6 | TODO | 0 | 0 | No | Collaboration Mode + User Input Requests | Add mode switching and pending user-input prompt handling. |
| 08 | 7 | TODO | 0 | 0 | No | UX Polish and Platform Readiness | Improve rendering and app stability across iOS and Android. |
| 09 | 8 | TODO | 0 | 0 | No | Deployment and Ops (Personal Use) | Establish safe Mac runtime patterns and personal app distribution path. |

## Phase Directories

- `.planning/phases/01-prep-and-decisions/`
- `.planning/phases/02-harden-farfield-for-remote-mobile-access/`
- `.planning/phases/03-create-expo-app-skeleton/`
- `.planning/phases/04-build-typed-mobile-api-client/`
- `.planning/phases/05-mvp-ui-threads-and-chat/`
- `.planning/phases/06-live-updates-sse-and-reconnect-behavior/`
- `.planning/phases/07-collaboration-mode-and-user-input-requests/`
- `.planning/phases/08-ux-polish-and-platform-readiness/`
- `.planning/phases/09-deployment-and-ops-personal-use/`

## Recommended Planning Order

1. Plan and execute Phase 01 to lock repo and transport decisions.
2. Plan and execute Phase 02 before using the app remotely.
3. Define and implement Farfield approval prompt APIs before or alongside Phases 04-05.
4. Build the mobile app incrementally in Phases 03-05.
5. Add resilience and advanced controls in Phases 06-07.
6. Finish with polish and deployment readiness in Phases 08-09.
