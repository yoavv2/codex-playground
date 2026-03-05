/**
 * Public API for the settings module.
 *
 * Re-exports settings/profile types and all storage functions.
 */
export type {
  ConnectionSettings,
  ConnectionProfileId,
  ConnectionProfile,
  ConnectionProfilesState,
} from "./types";
export {
  DEFAULT_SETTINGS,
  DEFAULT_CONNECTION_PROFILES_STATE,
} from "./types";
export {
  loadProfilesState,
  saveProfilesStateAndNotify,
  setActiveProfileAndNotify,
  updateProfileAndNotify,
  loadSettings,
  saveSettings,
  saveSettingsAndNotify,
  clearSettings,
  subscribeSettingsChanges,
} from "./storage";
