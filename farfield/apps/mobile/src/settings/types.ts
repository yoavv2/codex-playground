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

/**
 * Supported preset profile ids for remote access contexts.
 */
export type ConnectionProfileId = "local" | "tailscale";

/**
 * Complete profile payload persisted by the settings layer.
 */
export interface ConnectionProfile {
  id: ConnectionProfileId;
  label: string;
  serverUrl: string;
  authToken: string;
}

/**
 * Multi-profile settings state persisted by Phase 08.
 */
export interface ConnectionProfilesState {
  activeProfileId: ConnectionProfileId;
  profiles: Record<ConnectionProfileId, ConnectionProfile>;
}

/**
 * Deterministic defaults for the Local/Tailscale preset profiles.
 */
export const DEFAULT_CONNECTION_PROFILES_STATE: ConnectionProfilesState = {
  activeProfileId: "local",
  profiles: {
    local: {
      id: "local",
      label: "Local",
      serverUrl: "",
      authToken: "",
    },
    tailscale: {
      id: "tailscale",
      label: "Tailscale",
      serverUrl: "",
      authToken: "",
    },
  },
};
