/**
 * useSseConnection — AppState-aware SSE connection hook with bounded backoff.
 *
 * This hook owns the full lifecycle of a Farfield /events SSE connection:
 *   - Explicit state machine: idle → connecting → connected → reconnecting → error | paused
 *   - Capped exponential backoff with jitter between reconnect attempts
 *   - AppState integration: pauses reconnect churn when app goes to background,
 *     resumes immediately when the app returns to foreground
 *   - Retry metadata (attempt count, next-retry timestamp) for observability
 *   - Clean teardown: cancels all timers and listeners on unmount or settings change
 *
 * Consumers receive a stable `SseConnectionState` object and never need to
 * manage timers, AppState subscriptions, or duplicate-connection guards.
 *
 * Usage:
 *   const connection = useSseConnection(serverUrl, authToken, {
 *     onMessage: (payload) => handlePayload(payload),
 *   });
 *   // connection.status is one of: 'idle' | 'connecting' | 'connected' |
 *   //   'reconnecting' | 'paused' | 'error'
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

import {
  subscribeEvents,
  type FarfieldEventHandlers,
  type FarfieldEventPayload,
} from "@/src/api/events";

// ---------------------------------------------------------------------------
// Backoff configuration
// ---------------------------------------------------------------------------

/** Minimum delay before first reconnect attempt (ms). */
const BACKOFF_BASE_MS = 1_000;

/** Maximum reconnect delay cap (ms). */
const BACKOFF_MAX_MS = 30_000;

/** Jitter multiplier: actual delay is in [delay * (1 - JITTER), delay * (1 + JITTER)]. */
const JITTER_FACTOR = 0.25;

/** Maximum number of consecutive reconnect attempts before entering "error" state. */
const MAX_RETRIES = 8;

function calcBackoffMs(attempt: number): number {
  // Exponential: base * 2^attempt, capped at max
  const raw = BACKOFF_BASE_MS * Math.pow(2, attempt);
  const capped = Math.min(raw, BACKOFF_MAX_MS);
  // Add jitter: multiply by a random value in [(1 - JITTER), (1 + JITTER)]
  const jitter = 1 - JITTER_FACTOR + Math.random() * 2 * JITTER_FACTOR;
  return Math.round(capped * jitter);
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Connection status values for the SSE lifecycle state machine.
 *
 * idle        — Not started or has been explicitly stopped.
 * connecting  — First connection attempt in progress.
 * connected   — SSE stream is open and receiving events.
 * reconnecting— Connection was lost; a retry is scheduled or in progress.
 * paused      — App is in the background; reconnect is suppressed.
 * error       — Retry limit reached; manual intervention required.
 */
export type SseStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "paused"
  | "error";

/** Observable connection state returned by useSseConnection(). */
export interface SseConnectionState {
  /** Current lifecycle status. */
  status: SseStatus;
  /** Number of consecutive failed reconnect attempts (resets on success). */
  retryCount: number;
  /**
   * Unix timestamp (ms) when the next reconnect will be attempted,
   * or null when no retry is scheduled.
   */
  retryAt: number | null;
  /** Last error received from the transport, if any. */
  lastError: unknown;
}

/** Callbacks a consumer can pass to useSseConnection(). */
export interface SseConnectionHandlers {
  /** Called for every successfully parsed /events payload. */
  onMessage?: (payload: FarfieldEventPayload) => void;
  /**
   * Called when the connection status changes.
   * Receives the new SseConnectionState.
   */
  onStatusChange?: (state: SseConnectionState) => void;
}

// ---------------------------------------------------------------------------
// Internal state tracked in a ref (avoids stale closure issues)
// ---------------------------------------------------------------------------

interface InternalState {
  retryCount: number;
  retryTimerId: ReturnType<typeof setTimeout> | null;
  cleanupFn: (() => void) | null;
  stopped: boolean; // set true when the hook is unmounted or params reset
}

function makeInitialInternal(): InternalState {
  return {
    retryCount: 0,
    retryTimerId: null,
    cleanupFn: null,
    stopped: false,
  };
}

const INITIAL_STATE: SseConnectionState = {
  status: "idle",
  retryCount: 0,
  retryAt: null,
  lastError: null,
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Open and maintain an SSE connection to the Farfield /events endpoint.
 *
 * @param serverUrl - Base Farfield server URL. Pass null / "" to stay idle.
 * @param authToken - Optional bearer token for the Authorization header.
 * @param handlers  - Optional message and status-change callbacks.
 * @returns Current connection state (status, retryCount, retryAt, lastError).
 */
export function useSseConnection(
  serverUrl: string | null | undefined,
  authToken: string | null | undefined,
  handlers?: SseConnectionHandlers
): SseConnectionState {
  const [connState, setConnState] = useState<SseConnectionState>(INITIAL_STATE);

  // Stable ref to mutable internal state so callbacks don't capture stale vars
  const internal = useRef<InternalState>(makeInitialInternal());

  // Stable refs to handlers so callers can pass inline objects/functions
  const handlersRef = useRef<SseConnectionHandlers | undefined>(handlers);
  handlersRef.current = handlers;

  // Helper: update both the ref-based snapshot and React state atomically
  const updateState = useCallback((next: Partial<SseConnectionState>) => {
    setConnState((prev) => {
      const merged = { ...prev, ...next };
      handlersRef.current?.onStatusChange?.(merged);
      return merged;
    });
  }, []);

  // Helper: cancel any pending retry timer
  const clearRetryTimer = useCallback(() => {
    const t = internal.current.retryTimerId;
    if (t !== null) {
      clearTimeout(t);
      internal.current.retryTimerId = null;
    }
  }, []);

  // Helper: tear down an active connection
  const teardown = useCallback(() => {
    clearRetryTimer();
    internal.current.cleanupFn?.();
    internal.current.cleanupFn = null;
  }, [clearRetryTimer]);

  // Core: open a single SSE connection attempt
  // Declared via ref so scheduleReconnect can reference it before declaration
  const connectRef = useRef<() => void>(() => {});

  const connect = useCallback(() => {
    if (internal.current.stopped) return;
    if (!serverUrl || serverUrl.trim() === "") return;

    // Transition to connecting (or reconnecting on retry > 0)
    updateState({
      status: internal.current.retryCount === 0 ? "connecting" : "reconnecting",
      retryCount: internal.current.retryCount,
      retryAt: null,
    });

    const cleanup = subscribeEvents(
      serverUrl,
      authToken,
      {
        onOpen: () => {
          if (internal.current.stopped) return;
          // Reset retry count on successful connect
          internal.current.retryCount = 0;
          updateState({
            status: "connected",
            retryCount: 0,
            retryAt: null,
            lastError: null,
          });
        },
        onMessage: (payload) => {
          if (internal.current.stopped) return;
          handlersRef.current?.onMessage?.(payload);
        },
        onError: (err) => {
          if (internal.current.stopped) return;
          scheduleReconnect(err);
        },
        onClose: () => {
          if (internal.current.stopped) return;
          scheduleReconnect(null);
        },
      } satisfies FarfieldEventHandlers,
      // Disable library-managed retry — this hook owns reconnect policy
      { eventSourceConfig: { pollingInterval: 0 } }
    );

    internal.current.cleanupFn = cleanup;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverUrl, authToken, updateState]);

  connectRef.current = connect;

  // Schedule a retry attempt with capped exponential backoff + jitter
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const scheduleReconnect = useCallback(
    (err: unknown) => {
      if (internal.current.stopped) return;

      // Tear down the dead socket first
      internal.current.cleanupFn?.();
      internal.current.cleanupFn = null;
      clearRetryTimer();

      const attempt = internal.current.retryCount;

      if (attempt >= MAX_RETRIES) {
        updateState({ status: "error", lastError: err, retryAt: null });
        return;
      }

      const delayMs = calcBackoffMs(attempt);
      const retryAt = Date.now() + delayMs;
      internal.current.retryCount = attempt + 1;

      updateState({
        status: "reconnecting",
        retryCount: internal.current.retryCount,
        retryAt,
        lastError: err,
      });

      internal.current.retryTimerId = setTimeout(() => {
        internal.current.retryTimerId = null;
        connectRef.current();
      }, delayMs);
    },
    [clearRetryTimer, updateState]
  );

  // Main effect: start/stop when serverUrl or authToken changes
  useEffect(() => {
    internal.current = makeInitialInternal();

    if (!serverUrl || serverUrl.trim() === "") {
      setConnState(INITIAL_STATE);
      return;
    }

    connectRef.current();

    return () => {
      internal.current.stopped = true;
      teardown();
      setConnState(INITIAL_STATE);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverUrl, authToken]);

  // AppState integration: pause reconnect in background, resume in foreground
  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      const { stopped, retryTimerId, cleanupFn } = internal.current;
      if (stopped) return;

      if (nextState === "background" || nextState === "inactive") {
        // Pause: cancel pending retry, close any active socket
        clearRetryTimer();
        cleanupFn?.();
        internal.current.cleanupFn = null;
        // Only update to paused if we were actively working (not idle/error)
        setConnState((prev) => {
          if (prev.status === "idle" || prev.status === "error") return prev;
          const next: SseConnectionState = {
            ...prev,
            status: "paused",
            retryAt: null,
          };
          handlersRef.current?.onStatusChange?.(next);
          return next;
        });
      } else if (nextState === "active") {
        // Resume: reconnect immediately if we were paused
        setConnState((prev) => {
          if (prev.status !== "paused") return prev;
          // Kick off reconnect on next tick so state update settles first
          setTimeout(() => {
            if (!internal.current.stopped && retryTimerId === null) {
              connectRef.current();
            }
          }, 0);
          return prev; // connect will update state
        });
      }
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange
    );

    return () => {
      subscription.remove();
    };
  }, [clearRetryTimer]);

  return connState;
}
