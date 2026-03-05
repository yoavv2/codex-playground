/**
 * Settings persistence layer for @farfield/mobile.
 *
 * Phase 08 profile model:
 *   - Two preset profiles: local + tailscale
 *   - Active profile id persisted in AsyncStorage
 *   - Profile auth tokens persisted in SecureStore (or AsyncStorage on web)
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { z } from "zod";

import {
  ConnectionProfileId,
  ConnectionProfilesState,
  ConnectionSettings,
  DEFAULT_CONNECTION_PROFILES_STATE,
} from "./types";

// AsyncStorage keys for profile metadata (non-secret)
const ASYNC_KEY_PROFILES_STATE = "farfield.connectionProfilesState.v1";

// Legacy keys from the single-profile model (used for one-time migration)
const LEGACY_ASYNC_KEY_SERVER_URL = "farfield.serverUrl";
const LEGACY_ASYNC_KEY_PROFILE_LABEL = "farfield.profileLabel";

// SecureStore keys for sensitive values
const SECURE_KEY_AUTH_TOKEN_LOCAL = "farfield.authToken.local";
const SECURE_KEY_AUTH_TOKEN_TAILSCALE = "farfield.authToken.tailscale";
const LEGACY_SECURE_KEY_AUTH_TOKEN = "farfield.authToken";

// Lazy-loaded SecureStore — only available on native platforms
let _secureStore: typeof import("expo-secure-store") | null = null;

async function getSecureStore() {
  if (Platform.OS === "web") return null;
  if (!_secureStore) {
    _secureStore = await import("expo-secure-store");
  }
  return _secureStore;
}

async function secureGet(key: string): Promise<string | null> {
  const store = await getSecureStore();
  if (store) return store.getItemAsync(key);
  return AsyncStorage.getItem(key);
}

async function secureSet(key: string, value: string): Promise<void> {
  const store = await getSecureStore();
  if (store) return store.setItemAsync(key, value);
  return AsyncStorage.setItem(key, value);
}

async function secureDelete(key: string): Promise<void> {
  const store = await getSecureStore();
  if (store) return store.deleteItemAsync(key);
  return AsyncStorage.removeItem(key);
}

const ConnectionProfileIdSchema = z.union([z.literal("local"), z.literal("tailscale")]);

const PersistedConnectionProfileSchema = z
  .object({
    id: ConnectionProfileIdSchema,
    label: z.string(),
    serverUrl: z.string(),
  })
  .strict();

const PersistedConnectionProfilesStateSchema = z
  .object({
    activeProfileId: ConnectionProfileIdSchema,
    profiles: z
      .object({
        local: PersistedConnectionProfileSchema,
        tailscale: PersistedConnectionProfileSchema,
      })
      .strict(),
  })
  .strict();

type PersistedConnectionProfilesState = z.infer<typeof PersistedConnectionProfilesStateSchema>;

function activeSettingsFromState(state: ConnectionProfilesState): ConnectionSettings {
  const active = state.profiles[state.activeProfileId];
  return {
    serverUrl: active.serverUrl,
    authToken: active.authToken,
    profileLabel: active.label,
  };
}

function toPersistedState(state: ConnectionProfilesState): PersistedConnectionProfilesState {
  return {
    activeProfileId: state.activeProfileId,
    profiles: {
      local: {
        id: "local",
        label: state.profiles.local.label,
        serverUrl: state.profiles.local.serverUrl,
      },
      tailscale: {
        id: "tailscale",
        label: state.profiles.tailscale.label,
        serverUrl: state.profiles.tailscale.serverUrl,
      },
    },
  };
}

function fromPersistedState(
  persisted: PersistedConnectionProfilesState,
  authTokenLocal: string | null,
  authTokenTailscale: string | null
): ConnectionProfilesState {
  return {
    activeProfileId: persisted.activeProfileId,
    profiles: {
      local: {
        id: "local",
        label: persisted.profiles.local.label,
        serverUrl: persisted.profiles.local.serverUrl,
        authToken: authTokenLocal ?? "",
      },
      tailscale: {
        id: "tailscale",
        label: persisted.profiles.tailscale.label,
        serverUrl: persisted.profiles.tailscale.serverUrl,
        authToken: authTokenTailscale ?? "",
      },
    },
  };
}

function parsePersistedState(raw: string): PersistedConnectionProfilesState {
  let json;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    throw new Error("Invalid profile-state JSON in AsyncStorage.");
  }

  const parsed = PersistedConnectionProfilesStateSchema.safeParse(json);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "<root>";
      return `${path}: ${issue.message}`;
    });
    throw new Error(`Invalid profile-state structure: ${issues.join("; ")}`);
  }

  return parsed.data;
}

function normalizeProfileLabel(profileId: ConnectionProfileId, label: string | undefined): string {
  if (label && label.trim().length > 0) {
    return label.trim();
  }
  return profileId === "local" ? "Local" : "Tailscale";
}

async function writeProfilesState(state: ConnectionProfilesState): Promise<void> {
  const persisted = toPersistedState(state);

  await AsyncStorage.setItem(ASYNC_KEY_PROFILES_STATE, JSON.stringify(persisted));

  if (state.profiles.local.authToken) {
    await secureSet(SECURE_KEY_AUTH_TOKEN_LOCAL, state.profiles.local.authToken);
  } else {
    await secureDelete(SECURE_KEY_AUTH_TOKEN_LOCAL);
  }

  if (state.profiles.tailscale.authToken) {
    await secureSet(SECURE_KEY_AUTH_TOKEN_TAILSCALE, state.profiles.tailscale.authToken);
  } else {
    await secureDelete(SECURE_KEY_AUTH_TOKEN_TAILSCALE);
  }
}

async function migrateLegacyState(): Promise<ConnectionProfilesState> {
  const [legacyServerUrl, legacyProfileLabel, legacyAuthToken] = await Promise.all([
    AsyncStorage.getItem(LEGACY_ASYNC_KEY_SERVER_URL),
    AsyncStorage.getItem(LEGACY_ASYNC_KEY_PROFILE_LABEL),
    secureGet(LEGACY_SECURE_KEY_AUTH_TOKEN),
  ]);

  const next: ConnectionProfilesState = {
    activeProfileId: "local",
    profiles: {
      local: {
        ...DEFAULT_CONNECTION_PROFILES_STATE.profiles.local,
        label: normalizeProfileLabel("local", legacyProfileLabel ?? undefined),
        serverUrl: legacyServerUrl ?? "",
        authToken: legacyAuthToken ?? "",
      },
      tailscale: {
        ...DEFAULT_CONNECTION_PROFILES_STATE.profiles.tailscale,
      },
    },
  };

  await writeProfilesState(next);

  await Promise.all([
    AsyncStorage.removeItem(LEGACY_ASYNC_KEY_SERVER_URL),
    AsyncStorage.removeItem(LEGACY_ASYNC_KEY_PROFILE_LABEL),
    secureDelete(LEGACY_SECURE_KEY_AUTH_TOKEN),
  ]);

  return next;
}

/** Callback invoked with active profile settings whenever profile state is saved. */
export type SettingsChangeListener = (settings: ConnectionSettings) => void;

const _settingsListeners = new Set<SettingsChangeListener>();

function notifySettingsListeners(state: ConnectionProfilesState): void {
  const activeSettings = activeSettingsFromState(state);

  _settingsListeners.forEach((listener) => {
    try {
      listener(activeSettings);
    } catch (err) {
      console.warn("[settings] listener threw", err);
    }
  });
}

/**
 * Subscribe to active-profile settings changes.
 */
export function subscribeSettingsChanges(
  listener: SettingsChangeListener
): () => void {
  _settingsListeners.add(listener);
  return () => {
    _settingsListeners.delete(listener);
  };
}

/**
 * Load and return full profile state.
 */
export async function loadProfilesState(): Promise<ConnectionProfilesState> {
  const raw = await AsyncStorage.getItem(ASYNC_KEY_PROFILES_STATE);

  if (!raw) {
    return migrateLegacyState();
  }

  const persisted = parsePersistedState(raw);
  const [authTokenLocal, authTokenTailscale] = await Promise.all([
    secureGet(SECURE_KEY_AUTH_TOKEN_LOCAL),
    secureGet(SECURE_KEY_AUTH_TOKEN_TAILSCALE),
  ]);

  return fromPersistedState(persisted, authTokenLocal, authTokenTailscale);
}

/**
 * Persist full profile state and notify listeners with active settings.
 */
export async function saveProfilesStateAndNotify(
  state: ConnectionProfilesState
): Promise<void> {
  await writeProfilesState(state);
  notifySettingsListeners(state);
}

/**
 * Set active profile and notify listeners.
 */
export async function setActiveProfileAndNotify(
  profileId: ConnectionProfileId
): Promise<void> {
  const state = await loadProfilesState();
  const next: ConnectionProfilesState = {
    ...state,
    activeProfileId: profileId,
  };

  await saveProfilesStateAndNotify(next);
}

/**
 * Update one preset profile and notify listeners.
 */
export async function updateProfileAndNotify(
  profileId: ConnectionProfileId,
  patch: { serverUrl?: string; authToken?: string; label?: string }
): Promise<void> {
  const state = await loadProfilesState();
  const current = state.profiles[profileId];

  const nextProfile = {
    ...current,
    serverUrl: patch.serverUrl ?? current.serverUrl,
    authToken: patch.authToken ?? current.authToken,
    label: normalizeProfileLabel(profileId, patch.label ?? current.label),
  };

  const next: ConnectionProfilesState = {
    ...state,
    profiles: {
      ...state.profiles,
      [profileId]: nextProfile,
    },
  };

  await saveProfilesStateAndNotify(next);
}

/**
 * Load active profile as the legacy ConnectionSettings view.
 */
export async function loadSettings(): Promise<ConnectionSettings> {
  const state = await loadProfilesState();
  return activeSettingsFromState(state);
}

/**
 * Persist active-profile settings without notifying listeners.
 */
export async function saveSettings(
  settings: ConnectionSettings
): Promise<void> {
  const state = await loadProfilesState();
  const activeId = state.activeProfileId;
  const current = state.profiles[activeId];

  const next: ConnectionProfilesState = {
    ...state,
    profiles: {
      ...state.profiles,
      [activeId]: {
        ...current,
        serverUrl: settings.serverUrl,
        authToken: settings.authToken,
        label: normalizeProfileLabel(activeId, settings.profileLabel ?? current.label),
      },
    },
  };

  await writeProfilesState(next);
}

/**
 * Persist active-profile settings and notify listeners.
 */
export async function saveSettingsAndNotify(
  settings: ConnectionSettings
): Promise<void> {
  const state = await loadProfilesState();
  const activeId = state.activeProfileId;
  const current = state.profiles[activeId];

  const next: ConnectionProfilesState = {
    ...state,
    profiles: {
      ...state.profiles,
      [activeId]: {
        ...current,
        serverUrl: settings.serverUrl,
        authToken: settings.authToken,
        label: normalizeProfileLabel(activeId, settings.profileLabel ?? current.label),
      },
    },
  };

  await saveProfilesStateAndNotify(next);
}

/**
 * Clear all preset profiles and notify listeners.
 */
export async function clearSettings(): Promise<void> {
  const next: ConnectionProfilesState = {
    activeProfileId: DEFAULT_CONNECTION_PROFILES_STATE.activeProfileId,
    profiles: {
      local: { ...DEFAULT_CONNECTION_PROFILES_STATE.profiles.local },
      tailscale: { ...DEFAULT_CONNECTION_PROFILES_STATE.profiles.tailscale },
    },
  };

  await saveProfilesStateAndNotify(next);
}
