/**
 * event-routing.ts — Pure SSE payload classifier for Farfield /events stream.
 *
 * Translates raw FarfieldEventPayload objects (from the /events SSE stream) into
 * typed SyncIntent values that the LiveUpdatesProvider can act on without
 * any screen-specific parsing logic.
 *
 * Design principles:
 *   - Pure functions: no side effects, no React dependencies
 *   - Exhaustive coverage: every intent variant maps to a specific invalidation scope
 *   - Graceful fallback: unrecognised payloads produce SyncIntent.noOp (no throw)
 *   - Thread-specific invalidation is preferred over broad all-threads invalidation
 *     whenever a threadId can be extracted
 *
 * Event shape summary (from farfield/apps/server/src/index.ts):
 *
 *   State broadcast:
 *     { type: "state", state: { ... } }
 *     Sent when Farfield runtime state changes (agent connect/disconnect).
 *
 *   History entry:
 *     { type: "history", entry: { source, direction, payload, meta: { threadId?, ... } } }
 *     - source "ipc": raw IPC frame from Codex (message delta, tool output, etc.)
 *     - source "app": action events with payload.type = "action", payload.action, payload.stage
 *     - source "system": internal system messages
 *
 * Action names produced by the server:
 *   thread-create, messages, collaboration-mode, user-input, approval-response, interrupt
 */

import type { FarfieldEventPayload } from "@/src/api/events";

// ---------------------------------------------------------------------------
// Sync intent types
// ---------------------------------------------------------------------------

/**
 * No invalidation needed. Produced for keepalives, unrecognised events,
 * and intermediate action stages that don't require a refetch.
 */
export interface NoOpIntent {
  type: "no-op";
}

/**
 * Invalidate the thread list only (e.g. a new thread was created).
 */
export interface ThreadListChangedIntent {
  type: "thread-list-changed";
}

/**
 * Invalidate a specific thread's detail and approvals queries.
 * When threadId is provided, only that thread is targeted.
 * When threadId is absent, all thread detail + approvals are invalidated.
 */
export interface ThreadDetailChangedIntent {
  type: "thread-detail-changed";
  threadId: string | null;
}

/**
 * Invalidate both the thread list and a specific thread's detail/approvals.
 * Used when an event may affect the list summary AND the detail view.
 */
export interface ThreadListAndDetailChangedIntent {
  type: "thread-list-and-detail-changed";
  threadId: string | null;
}

/**
 * Invalidate pending approvals for a thread.
 */
export interface ApprovalsChangedIntent {
  type: "approvals-changed";
  threadId: string | null;
}

/**
 * Invalidate collaboration mode data for a thread.
 */
export interface CollaborationModeChangedIntent {
  type: "collaboration-mode-changed";
  threadId: string | null;
}

/**
 * Union of all sync intents produced by routeEvent().
 */
export type SyncIntent =
  | NoOpIntent
  | ThreadListChangedIntent
  | ThreadDetailChangedIntent
  | ThreadListAndDetailChangedIntent
  | ApprovalsChangedIntent
  | CollaborationModeChangedIntent;

// ---------------------------------------------------------------------------
// Intent constructors (internal)
// ---------------------------------------------------------------------------

const noOp = (): NoOpIntent => ({ type: "no-op" });

const threadListChanged = (): ThreadListChangedIntent => ({
  type: "thread-list-changed",
});

const threadDetailChanged = (threadId: string | null): ThreadDetailChangedIntent => ({
  type: "thread-detail-changed",
  threadId,
});

const threadListAndDetailChanged = (
  threadId: string | null
): ThreadListAndDetailChangedIntent => ({
  type: "thread-list-and-detail-changed",
  threadId,
});

const approvalsChanged = (threadId: string | null): ApprovalsChangedIntent => ({
  type: "approvals-changed",
  threadId,
});

const collaborationModeChanged = (
  threadId: string | null
): CollaborationModeChangedIntent => ({
  type: "collaboration-mode-changed",
  threadId,
});

// ---------------------------------------------------------------------------
// Helpers: safe field extraction
// ---------------------------------------------------------------------------

function safeString(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function safeRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

// ---------------------------------------------------------------------------
// Action routing
// ---------------------------------------------------------------------------

/**
 * Route an action payload (produced by server pushActionEvent calls).
 *
 * Action structure (from pushActionEvent in index.ts):
 *   { type: "action", action: string, stage: "attempt"|"success"|"error", threadId?, ... }
 *
 * We only act on "success" stage — attempt/error do not require a refetch.
 */
function routeActionPayload(
  actionPayload: Record<string, unknown>,
  metaThreadId: string | null
): SyncIntent {
  const action = safeString(actionPayload["action"]);
  const stage = safeString(actionPayload["stage"]);

  // Only invalidate on successful completion — intermediate states are noise
  if (stage !== "success") {
    return noOp();
  }

  // threadId can live in the action payload directly, or in the history entry meta
  const payloadThreadId = safeString(actionPayload["threadId"]);
  const threadId = payloadThreadId ?? metaThreadId;

  if (!action) {
    return noOp();
  }

  switch (action) {
    // A new thread was created — refresh the list, and also preemptively
    // refresh detail if threadId is available
    case "thread-create":
      return threadId
        ? threadListAndDetailChanged(threadId)
        : threadListChanged();

    // A message was sent to an active thread — refresh detail + list
    // (preview in the list updates when a new message is appended)
    case "messages":
      return threadListAndDetailChanged(threadId);

    // User input submitted — the thread state will update
    case "user-input":
      return threadDetailChanged(threadId);

    // Approval submitted — refresh approvals and thread detail
    case "approval-response":
      return approvalsChanged(threadId);

    // Collaboration mode changed — refresh collab mode key
    case "collaboration-mode":
      return collaborationModeChanged(threadId);

    // Thread interrupted — refresh detail (running status may change)
    case "interrupt":
      return threadDetailChanged(threadId);

    // Unknown action — no-op to avoid spurious invalidation
    default:
      return noOp();
  }
}

// ---------------------------------------------------------------------------
// IPC frame routing
// ---------------------------------------------------------------------------

/**
 * Route a raw IPC history entry (source = "ipc").
 *
 * IPC frames carry Codex protocol messages: message deltas, tool results,
 * system events, etc. We treat any IPC frame as a signal that the active
 * thread detail may have changed. The threadId lives in entry.meta.
 */
function routeIpcHistoryEntry(
  metaThreadId: string | null
): SyncIntent {
  // IPC frames are high-frequency (one per message delta/tool call).
  // We return a thread-detail intent so the provider can debounce/coalesce
  // many rapid IPC events into a single invalidation.
  return threadDetailChanged(metaThreadId);
}

// ---------------------------------------------------------------------------
// History entry routing
// ---------------------------------------------------------------------------

/**
 * Route a history entry (type = "history" at the top level).
 *
 * Entry structure:
 *   { id, at, source: "ipc"|"app"|"system", direction, payload, meta: { threadId?, ... } }
 */
function routeHistoryEntry(entry: Record<string, unknown>): SyncIntent {
  const source = safeString(entry["source"]);
  const payload = safeRecord(entry["payload"]);
  const meta = safeRecord(entry["meta"]);
  const metaThreadId = meta ? safeString(meta["threadId"]) : null;

  if (source === "ipc") {
    return routeIpcHistoryEntry(metaThreadId);
  }

  if (source === "app") {
    // App-level action events: payload.type === "action"
    if (payload && safeString(payload["type"]) === "action") {
      return routeActionPayload(payload, metaThreadId);
    }
    return noOp();
  }

  // source === "system" — internal log messages, not actionable
  return noOp();
}

// ---------------------------------------------------------------------------
// Top-level router
// ---------------------------------------------------------------------------

/**
 * Classify a raw /events payload into a SyncIntent.
 *
 * This is the primary entry point — call it from the LiveUpdatesProvider's
 * onMessage handler to translate every SSE event into an action.
 *
 * @param payload - Parsed FarfieldEventPayload from the /events stream
 * @returns A SyncIntent describing what cache keys to invalidate (or no-op)
 *
 * @example
 * const intent = routeEvent(payload);
 * if (intent.type !== "no-op") {
 *   applyIntent(intent, queryClient);
 * }
 */
export function routeEvent(payload: FarfieldEventPayload): SyncIntent {
  const rec = safeRecord(payload);
  if (!rec) {
    return noOp();
  }

  const topType = safeString(rec["type"]);

  // State broadcasts: Farfield runtime changed (agent connect/disconnect).
  // The thread list may have changed (agent reconnected, new threads available).
  if (topType === "state") {
    return threadListChanged();
  }

  // History entries: IPC frames and app-level action events
  if (topType === "history") {
    const entry = safeRecord(rec["entry"]);
    if (!entry) {
      return noOp();
    }
    return routeHistoryEntry(entry);
  }

  // Unknown top-level type — no-op
  return noOp();
}
