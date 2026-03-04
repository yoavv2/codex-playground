/**
 * useLiveUpdates — stable consumer hook for the app-wide live-update pipeline.
 *
 * Exposes the current SSE connection state (status, retryCount, retryAt,
 * lastError) and a saveSettings helper from the nearest LiveUpdatesProvider.
 *
 * This module is a thin re-export of the hook defined in LiveUpdatesProvider
 * so screens and hooks can import from a predictable, dedicated path:
 *
 *   import { useLiveUpdates } from "@/src/live/useLiveUpdates";
 *
 * rather than importing from the provider module directly (which also exports
 * the provider component and context types).
 *
 * Connection status values:
 *   "idle"        — SSE not started (no settings configured yet)
 *   "connecting"  — First connection attempt in progress
 *   "connected"   — Stream is open and receiving events
 *   "reconnecting"— Connection lost; retry scheduled
 *   "paused"      — App backgrounded; reconnect suppressed
 *   "error"       — Retry limit reached; manual reconnect needed
 *
 * @example
 * function MyComponent() {
 *   const { status, retryCount, retryAt, lastError } = useLiveUpdates();
 *   return <Text>{status}</Text>;
 * }
 */

export { useLiveUpdates } from "@/src/live/LiveUpdatesProvider";
export type { LiveUpdatesContextValue } from "@/src/live/LiveUpdatesProvider";
