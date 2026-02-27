/**
 * Public API for the settings module.
 *
 * Re-exports the ConnectionSettings type, DEFAULT_SETTINGS,
 * and all storage functions for convenience.
 */
export type { ConnectionSettings } from "./types";
export { DEFAULT_SETTINGS } from "./types";
export { loadSettings, saveSettings, clearSettings } from "./storage";
