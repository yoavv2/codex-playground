/**
 * Connection settings model for the Farfield mobile app.
 *
 * - serverUrl: base URL of the Farfield server (e.g. http://100.x.x.x:4311)
 * - authToken: bearer token for /api/* and /events authentication (sensitive — stored in SecureStore)
 * - profileLabel: optional display name for the connection profile (non-secret — stored in AsyncStorage)
 */
export interface ConnectionSettings {
  serverUrl: string;
  authToken: string;
  profileLabel?: string;
}

/**
 * Blank/default settings used before the user has configured the app.
 */
export const DEFAULT_SETTINGS: ConnectionSettings = {
  serverUrl: "",
  authToken: "",
  profileLabel: undefined,
};
