/**
 * Low-level SSE subscription helper for the Farfield /events endpoint.
 *
 * The /events stream delivers server-side events in text/event-stream format.
 * Each `data:` line is a JSON object; the server sends an initial "state"
 * event and "history" events as the IPC stream produces frames.
 *
 * Authentication:
 *   react-native-sse supports custom request headers, so we prefer the
 *   Authorization: Bearer ... header. There is no query-param fallback path
 *   in this helper because react-native-sse sends headers on all platforms
 *   supported by this app (iOS, Android, web via polyfill).
 *
 * Reconnect policy:
 *   Basic/intentional. The server sends `retry: 1000` in the initial frame
 *   and react-native-sse will use that as the reconnect delay. Robust
 *   reconnect UI (exponential backoff, user-visible status) is deferred to
 *   Phase 06 by design.
 *
 * Usage:
 *   const cleanup = subscribeEvents(serverUrl, authToken, {
 *     onMessage: (event) => { ... },
 *     onOpen: () => { ... },
 *     onError: (err) => { ... },
 *   });
 *   // Call cleanup() to close the connection.
 */

import EventSource from "react-native-sse";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A raw parsed event payload received on the /events stream. */
export type FarfieldEventPayload = Record<string, unknown>;

/** Handlers passed to subscribeEvents(). */
export interface FarfieldEventHandlers {
  /** Called when a `data:` message is successfully parsed as JSON. */
  onMessage?: (payload: FarfieldEventPayload) => void;
  /** Called when the SSE connection opens or reconnects. */
  onOpen?: () => void;
  /** Called when the SSE connection closes cleanly. */
  onClose?: () => void;
  /**
   * Called on parse errors or SSE transport errors.
   * The error object may be a string (JSON parse failure) or an Error.
   */
  onError?: (error: unknown) => void;
}

/** Return value of subscribeEvents() — call to close the connection. */
export type UnsubscribeFn = () => void;

// ---------------------------------------------------------------------------
// Core subscription helper
// ---------------------------------------------------------------------------

/**
 * Open an authenticated SSE connection to /events.
 *
 * @param serverUrl  - Base URL of the Farfield server (e.g. http://100.x.x.x:4311).
 *                     A trailing slash is accepted.
 * @param authToken  - Optional bearer token. When provided and non-empty the
 *                     Authorization header is set on the SSE request.
 * @param handlers   - Callbacks for connection lifecycle and message events.
 * @returns A cleanup function. Call it to close the EventSource.
 */
export function subscribeEvents(
  serverUrl: string,
  authToken: string | null | undefined,
  handlers: FarfieldEventHandlers
): UnsubscribeFn {
  const baseUrl = serverUrl.replace(/\/+$/, "");
  const url = `${baseUrl}/events`;

  const headers: Record<string, string> = {
    Accept: "text/event-stream",
  };

  if (authToken && authToken.trim() !== "") {
    headers["Authorization"] = `Bearer ${authToken.trim()}`;
  }

  const eventSource = new EventSource(url, { headers });

  const handleOpen = () => {
    handlers.onOpen?.();
  };

  const handleMessage = (event: { type: "message"; data: string | null }) => {
    const raw = event.data;
    if (!raw) {
      return;
    }
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (typeof parsed === "object" && parsed !== null) {
        handlers.onMessage?.(parsed as FarfieldEventPayload);
      }
    } catch (err) {
      handlers.onError?.(
        new Error(
          `Failed to parse /events message: ${err instanceof Error ? err.message : String(err)}`
        )
      );
    }
  };

  const handleError = (event: unknown) => {
    handlers.onError?.(event);
  };

  const handleClose = () => {
    handlers.onClose?.();
  };

  eventSource.addEventListener("open", handleOpen);
  eventSource.addEventListener("message", handleMessage);
  eventSource.addEventListener("error", handleError);
  eventSource.addEventListener("close", handleClose);

  return () => {
    eventSource.removeAllEventListeners();
    eventSource.close();
  };
}
