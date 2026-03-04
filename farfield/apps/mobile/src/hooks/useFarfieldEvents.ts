/**
 * React hook wrapper for the Farfield /events SSE subscription.
 *
 * Manages the EventSource lifecycle inside a React component or screen:
 *   - Opens the connection when serverUrl is truthy.
 *   - Closes and re-opens when serverUrl or authToken changes.
 *   - Always cleans up on unmount.
 *
 * The hook does NOT own reconnect UI, exponential backoff, or live-state
 * wiring. Those belong to Phase 06. This is the primitive that Phase 05+
 * components build on.
 *
 * Usage:
 *   useFarfieldEvents(serverUrl, authToken, {
 *     onMessage: (payload) => { ... },
 *     onOpen: () => setConnected(true),
 *     onError: (err) => console.warn("SSE error", err),
 *   });
 */

import { useEffect, useRef } from "react";

import { subscribeEvents, type FarfieldEventHandlers } from "@/src/api/events";

/**
 * Subscribe to the Farfield /events stream for the lifetime of the component.
 *
 * The subscription is started / restarted whenever `serverUrl` or `authToken`
 * changes, and cleaned up on unmount.
 *
 * @param serverUrl - Base Farfield server URL. Pass `null` or `""` to skip
 *                    opening the connection (e.g. while settings are loading).
 * @param authToken - Optional bearer token for the Authorization header.
 * @param handlers  - Stable callback references for lifecycle and message events.
 *                    Wrap in useCallback or useMemo to avoid restart churn.
 */
export function useFarfieldEvents(
  serverUrl: string | null | undefined,
  authToken: string | null | undefined,
  handlers: FarfieldEventHandlers
): void {
  // Keep a ref to the latest handlers so the effect closure is stable even if
  // callers supply inline arrow functions. We still re-subscribe when
  // serverUrl/authToken change, which is the correct reconnect trigger.
  const handlersRef = useRef<FarfieldEventHandlers>(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!serverUrl || serverUrl.trim() === "") {
      return;
    }

    const cleanup = subscribeEvents(serverUrl, authToken, {
      onOpen: () => handlersRef.current.onOpen?.(),
      onClose: () => handlersRef.current.onClose?.(),
      onMessage: (payload) => handlersRef.current.onMessage?.(payload),
      onError: (err) => handlersRef.current.onError?.(err),
    });

    return cleanup;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverUrl, authToken]);
}
