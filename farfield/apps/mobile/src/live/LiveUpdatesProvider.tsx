/**
 * LiveUpdatesProvider — app-wide SSE connection context for Phase 06.
 *
 * Responsibilities:
 *   1. Load connection settings from storage on mount.
 *   2. Subscribe to settings changes so URL/token edits (saved via
 *      saveSettingsAndNotify) trigger a clean SSE reconnect without a
 *      full app restart.
 *   3. Drive useSseConnection() with the current settings.
 *   4. Expose connection status via React context so any screen or hook
 *      can observe live-update state.
 *
 * Intentional scope boundary:
 *   This provider establishes the transport + state-distribution foundation.
 *   Query invalidation (TanStack Query refetch on SSE messages) is wired in
 *   Phase 06-02, not here.
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

  // Drive the SSE connection — useSseConnection owns all retry/backoff/AppState logic
  const sseState = useSseConnection(serverUrl, authToken);

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
