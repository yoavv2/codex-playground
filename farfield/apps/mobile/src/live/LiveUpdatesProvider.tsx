/**
 * LiveUpdatesProvider — app-wide SSE connection context for Phase 06.
 *
 * Responsibilities:
 *   1. Load connection settings from storage on mount.
 *   2. Subscribe to settings changes so URL/token edits (saved via
 *      saveSettingsAndNotify) trigger a clean SSE reconnect without a
 *      full app restart.
 *   3. Drive useSseConnection() with the current settings.
 *   4. Route incoming SSE messages to TanStack Query invalidations using
 *      routeEvent() and per-domain debounce/coalescing.
 *   5. Expose connection status via React context so any screen or hook
 *      can observe live-update state.
 *
 * Invalidation strategy:
 *   - Each SyncIntent domain has its own debounce timer so that a burst of
 *     rapid IPC frames (e.g. Codex streaming output) collapses into a single
 *     invalidation per domain, not N separate refetches.
 *   - Thread-specific invalidation is preferred over broad "invalidate all"
 *     whenever routeEvent() can extract a threadId.
 *   - REST endpoints remain the source of truth; SSE is purely a signal.
 *
 * Debounce windows (ms):
 *   THREAD_LIST_DEBOUNCE_MS   — 800 ms (list updates are low-urgency)
 *   THREAD_DETAIL_DEBOUNCE_MS — 400 ms (detail updates are more time-sensitive)
 *   APPROVALS_DEBOUNCE_MS     — 300 ms (approval prompts need fast response)
 *   COLLAB_MODE_DEBOUNCE_MS   — 800 ms (mode changes are infrequent)
 *
 * Usage (wrap the app root, e.g. in app/_layout.tsx):
 *
 *   <LiveUpdatesProvider>
 *     {children}
 *   </LiveUpdatesProvider>
 *
 * Consuming connection state in a screen or hook:
 *
 *   const { status, retryCount, retryAt, lastError } = useLiveUpdates();
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";

import {
  loadSettings,
  saveSettingsAndNotify,
  subscribeSettingsChanges,
} from "@/src/settings/storage";
import type { ConnectionSettings } from "@/src/settings/types";
import {
  useSseConnection,
  type SseConnectionState,
} from "@/src/hooks/useSseConnection";
import { queryKeys } from "@/src/api/queryKeys";
import type { FarfieldEventPayload } from "@/src/api/events";
import { routeEvent } from "@/src/live/event-routing";

// ---------------------------------------------------------------------------
// Debounce windows
// ---------------------------------------------------------------------------

/** How long to wait after the last thread-list-changing event before invalidating. */
const THREAD_LIST_DEBOUNCE_MS = 800;

/**
 * How long to wait after the last thread-detail-changing event before
 * invalidating a specific thread. Per-thread debounce windows are tracked
 * independently so a burst on one thread doesn't suppress updates on another.
 */
const THREAD_DETAIL_DEBOUNCE_MS = 400;

/** Approval prompts need faster feedback. */
const APPROVALS_DEBOUNCE_MS = 300;

/** Collaboration mode changes are infrequent; a longer window is fine. */
const COLLAB_MODE_DEBOUNCE_MS = 800;

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

/**
 * Value exposed by LiveUpdatesContext.
 *
 * Consumers read `status` to understand the live-update connection health
 * and `retryCount`/`retryAt`/`lastError` for observability.
 */
export interface LiveUpdatesContextValue extends SseConnectionState {
  /**
   * Re-expose saveSettingsAndNotify so Settings screen can call a single
   * function that both persists and rotates the SSE connection.
   */
  saveSettings: typeof saveSettingsAndNotify;
}

const LiveUpdatesContext = createContext<LiveUpdatesContextValue | null>(null);

// ---------------------------------------------------------------------------
// Debounced invalidation hook (internal)
// ---------------------------------------------------------------------------

/**
 * Returns a stable `handleMessage` callback that routes SSE payloads to
 * debounced TanStack Query invalidations.
 *
 * Per-domain timers:
 *   - A single timer for thread-list invalidation (coalesces list-affecting events)
 *   - A per-threadId Map of timers for thread-detail invalidation
 *   - A per-threadId Map of timers for approvals invalidation
 *   - A single timer for collaboration-mode invalidation
 *
 * All timers are cleared on unmount via the returned cleanup function.
 */
function useInvalidationHandler() {
  const queryClient = useQueryClient();

  // Per-domain timer refs (cleared on unmount)
  const listTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const detailTimersRef = useRef<Map<string | null, ReturnType<typeof setTimeout>>>(
    new Map()
  );
  const approvalsTimersRef = useRef<Map<string | null, ReturnType<typeof setTimeout>>>(
    new Map()
  );
  const collabTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stable refs for queryClient (React Query guarantees QueryClient is stable,
  // but using a ref avoids any lint/exhaustive-deps warnings in callbacks)
  const queryClientRef = useRef(queryClient);
  queryClientRef.current = queryClient;

  /**
   * Debounce helper: replaces any existing timer for the given key in the map
   * with a new one that fires after `delayMs`.
   */
  const debounce = useCallback(
    (
      timerMap: Map<string | null, ReturnType<typeof setTimeout>>,
      key: string | null,
      delayMs: number,
      fn: () => void
    ) => {
      const existing = timerMap.get(key);
      if (existing !== undefined) {
        clearTimeout(existing);
      }
      timerMap.set(
        key,
        setTimeout(() => {
          timerMap.delete(key);
          fn();
        }, delayMs)
      );
    },
    []
  );

  /**
   * Debounce the single thread-list timer (no per-key bucketing needed).
   */
  const debounceList = useCallback(
    (delayMs: number, fn: () => void) => {
      if (listTimerRef.current !== null) {
        clearTimeout(listTimerRef.current);
      }
      listTimerRef.current = setTimeout(() => {
        listTimerRef.current = null;
        fn();
      }, delayMs);
    },
    []
  );

  /**
   * Debounce the single collab-mode timer.
   */
  const debounceCollab = useCallback(
    (delayMs: number, fn: () => void) => {
      if (collabTimerRef.current !== null) {
        clearTimeout(collabTimerRef.current);
      }
      collabTimerRef.current = setTimeout(() => {
        collabTimerRef.current = null;
        fn();
      }, delayMs);
    },
    []
  );

  const handleMessage = useCallback(
    (payload: FarfieldEventPayload) => {
      const intent = routeEvent(payload);

      switch (intent.type) {
        case "no-op":
          return;

        case "thread-list-changed":
          debounceList(THREAD_LIST_DEBOUNCE_MS, () => {
            void queryClientRef.current.invalidateQueries({
              queryKey: queryKeys.threads.list(),
            });
          });
          return;

        case "thread-detail-changed": {
          const { threadId } = intent;
          debounce(
            detailTimersRef.current,
            threadId,
            THREAD_DETAIL_DEBOUNCE_MS,
            () => {
              if (threadId) {
                void queryClientRef.current.invalidateQueries({
                  queryKey: queryKeys.threads.detail(threadId),
                });
              } else {
                // No threadId known — invalidate all thread detail queries
                void queryClientRef.current.invalidateQueries({
                  queryKey: queryKeys.threads.all,
                });
              }
            }
          );
          return;
        }

        case "thread-list-and-detail-changed": {
          const { threadId } = intent;
          // List — shared timer
          debounceList(THREAD_LIST_DEBOUNCE_MS, () => {
            void queryClientRef.current.invalidateQueries({
              queryKey: queryKeys.threads.list(),
            });
          });
          // Detail — per-thread timer
          debounce(
            detailTimersRef.current,
            threadId,
            THREAD_DETAIL_DEBOUNCE_MS,
            () => {
              if (threadId) {
                void queryClientRef.current.invalidateQueries({
                  queryKey: queryKeys.threads.detail(threadId),
                });
              } else {
                void queryClientRef.current.invalidateQueries({
                  queryKey: queryKeys.threads.all,
                });
              }
            }
          );
          return;
        }

        case "approvals-changed": {
          const { threadId } = intent;
          debounce(
            approvalsTimersRef.current,
            threadId,
            APPROVALS_DEBOUNCE_MS,
            () => {
              if (threadId) {
                void queryClientRef.current.invalidateQueries({
                  queryKey: queryKeys.approvals.pending(threadId),
                });
              } else {
                void queryClientRef.current.invalidateQueries({
                  queryKey: queryKeys.approvals.all,
                });
              }
            }
          );
          return;
        }

        case "collaboration-mode-changed": {
          const { threadId } = intent;
          debounceCollab(COLLAB_MODE_DEBOUNCE_MS, () => {
            if (threadId) {
              void queryClientRef.current.invalidateQueries({
                queryKey: queryKeys.collaborationModes.forThread(threadId),
              });
            } else {
              void queryClientRef.current.invalidateQueries({
                queryKey: queryKeys.collaborationModes.all,
              });
            }
          });
          return;
        }
      }
    },
    [debounce, debounceList, debounceCollab]
  );

  // Cleanup: clear all pending timers on unmount
  const cleanup = useCallback(() => {
    if (listTimerRef.current !== null) {
      clearTimeout(listTimerRef.current);
      listTimerRef.current = null;
    }
    detailTimersRef.current.forEach((t) => clearTimeout(t));
    detailTimersRef.current.clear();
    approvalsTimersRef.current.forEach((t) => clearTimeout(t));
    approvalsTimersRef.current.clear();
    if (collabTimerRef.current !== null) {
      clearTimeout(collabTimerRef.current);
      collabTimerRef.current = null;
    }
  }, []);

  return { handleMessage, cleanup };
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface LiveUpdatesProviderProps {
  children: React.ReactNode;
}

/**
 * Wrap the app root with this provider to enable app-wide live-update state.
 */
export function LiveUpdatesProvider({ children }: LiveUpdatesProviderProps) {
  // Settings state — loaded async on mount, updated on settings-change events
  const [settings, setSettings] = useState<ConnectionSettings | null>(null);

  // Track whether we've completed the initial settings load
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Load initial settings from storage
  useEffect(() => {
    let cancelled = false;

    loadSettings()
      .then((loaded) => {
        if (!cancelled) {
          setSettings(loaded);
          setSettingsLoaded(true);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.warn("[LiveUpdatesProvider] Failed to load settings:", err);
          setSettingsLoaded(true); // proceed without settings (connection stays idle)
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Subscribe to settings changes (triggered by saveSettingsAndNotify)
  useEffect(() => {
    const unsubscribe = subscribeSettingsChanges((next) => {
      setSettings(next);
    });
    return unsubscribe;
  }, []);

  // Derive SSE connection params from settings (null until settings are loaded)
  const serverUrl =
    settingsLoaded && settings?.serverUrl ? settings.serverUrl : null;
  const authToken =
    settingsLoaded && settings?.authToken ? settings.authToken : null;

  // Debounced query invalidation handler
  const { handleMessage, cleanup } = useInvalidationHandler();

  // Clean up all pending debounce timers on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  // Drive the SSE connection — useSseConnection owns all retry/backoff/AppState logic
  const sseState = useSseConnection(serverUrl, authToken, {
    onMessage: handleMessage,
  });

  // Stable reference to saveSettingsAndNotify for context consumers
  const saveSettingsRef = useRef(saveSettingsAndNotify);

  const contextValue: LiveUpdatesContextValue = {
    ...sseState,
    saveSettings: saveSettingsRef.current,
  };

  return (
    <LiveUpdatesContext.Provider value={contextValue}>
      {children}
    </LiveUpdatesContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Consumer hook
// ---------------------------------------------------------------------------

/**
 * Access the live-updates connection state from any component inside
 * `<LiveUpdatesProvider>`.
 *
 * Throws if called outside the provider tree to catch misconfiguration early.
 */
export function useLiveUpdates(): LiveUpdatesContextValue {
  const ctx = useContext(LiveUpdatesContext);
  if (ctx === null) {
    throw new Error(
      "useLiveUpdates() must be called inside <LiveUpdatesProvider>. " +
        "Ensure LiveUpdatesProvider wraps the app root in app/_layout.tsx."
    );
  }
  return ctx;
}
