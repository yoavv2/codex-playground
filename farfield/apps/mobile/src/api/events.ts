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
 *   By default, the server sends `retry: 1000` in the initial frame and
 *   react-native-sse would use that as the reconnect delay. Callers that
 *   want to own reconnect policy (e.g. exponential backoff in a hook) should
 *   pass `pollingInterval: 0` in `options.eventSourceConfig` which disables
 *   library-side polling so the hook can re-call subscribeEvents itself.
 *
 * Usage:
 *   const cleanup = subscribeEvents(serverUrl, authToken, {
 *     onMessage: (event) => { ... },
 *     onOpen: () => { ... },
 *     onError: (err) => { ... },
 *   });
 *   // Call cleanup() to close the connection.
 *
 *   // With caller-controlled reconnect (disables library retry):
 *   const cleanup = subscribeEvents(serverUrl, authToken, handlers, {
 *     eventSourceConfig: { pollingInterval: 0 },
 *   });
 */

import EventSource from "react-native-sse";

// ---------------------------------------------------------------------------
// Typed payload shapes for /events stream data
// ---------------------------------------------------------------------------

/**
 * The "state" event is sent once when the SSE connection opens.
 * It carries a snapshot of the current Farfield process/IPC state.
 */
export interface FarfieldStatePayload {
  type: "state";
  [key: string]: unknown;
}

/**
 * "history" events carry incremental IPC frames produced by the server.
 */
export interface FarfieldHistoryPayload {
  type: "history";
  [key: string]: unknown;
}

/**
 * Union of all typed event payloads delivered on the /events stream.
 * Unknown event types are captured by the fallback shape.
 */
export type FarfieldEventPayload =
  | FarfieldStatePayload
  | FarfieldHistoryPayload
  | ({ type: string } & Record<string, unknown>)
  | Record<string, unknown>;

// ---------------------------------------------------------------------------
// EventSource configuration passthrough
// ---------------------------------------------------------------------------

/**
 * Optional configuration forwarded to the underlying react-native-sse
 * EventSource constructor. All fields are optional.
 *
 * Key field for reconnect control:
 *   `pollingInterval` — Set to 0 to disable the library's automatic retry loop.
 *   The default (undefined) preserves library behaviour (server-driven retry).
 */
export interface EventSourceConfig {
  /** Polling interval in ms. Set to 0 to disable automatic reconnection. */
  pollingInterval?: number;
  /** XHR timeout in ms (0 = no timeout, the default). */
  timeout?: number;
  /**
   * Delay before the first connection attempt in ms.
   * Default in react-native-sse is 500 ms.
   */
  timeoutBeforeConnection?: number;
  /** Enable verbose EventSource debug logging. */
  debug?: boolean;
}

// ---------------------------------------------------------------------------
// Handler contract
// ---------------------------------------------------------------------------

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

/** Options bag for subscribeEvents(). */
export interface SubscribeEventsOptions {
  /**
   * Configuration forwarded to the react-native-sse EventSource constructor.
   * Pass `{ pollingInterval: 0 }` to disable library-managed reconnect and
   * let the calling hook own the retry/backoff policy.
   */
  eventSourceConfig?: EventSourceConfig;
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
 * @param options    - Optional configuration, including EventSource passthrough.
 * @returns A cleanup function. Call it to close the EventSource.
 */
export function subscribeEvents(
  serverUrl: string,
  authToken: string | null | undefined,
  handlers: FarfieldEventHandlers,
  options?: SubscribeEventsOptions
): UnsubscribeFn {
  const baseUrl = serverUrl.replace(/\/+$/, "");
  const url = `${baseUrl}/events`;

  const headers: Record<string, string> = {
    Accept: "text/event-stream",
  };

  if (authToken && authToken.trim() !== "") {
    headers["Authorization"] = `Bearer ${authToken.trim()}`;
  }

  // Build EventSource options: start with any caller-provided config,
  // then inject our auth headers on top.
  const eventSourceOptions: Record<string, unknown> = {
    ...(options?.eventSourceConfig ?? {}),
    headers,
  };

  const eventSource = new EventSource(url, eventSourceOptions);

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
