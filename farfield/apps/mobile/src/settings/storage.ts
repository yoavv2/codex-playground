/**
 * Settings persistence layer for @farfield/mobile.
 *
 * Storage strategy (per Phase 03 decision lock):
 *   - authToken       → expo-secure-store  (device-encrypted; sensitive)
 *   - serverUrl       → AsyncStorage       (non-secret; readable profile config)
 *   - profileLabel    → AsyncStorage       (non-secret; optional display label)
 *
 * On web, expo-secure-store is unavailable so authToken falls back to AsyncStorage.
 *
 * Usage:
 *   const settings = await loadSettings();
 *   await saveSettings({ serverUrl, authToken, profileLabel });
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import { ConnectionSettings, DEFAULT_SETTINGS } from "./types";

// AsyncStorage keys (non-secret values)
const ASYNC_KEY_SERVER_URL = "farfield.serverUrl";
const ASYNC_KEY_PROFILE_LABEL = "farfield.profileLabel";

// SecureStore key / AsyncStorage fallback key (sensitive: auth token)
const SECURE_KEY_AUTH_TOKEN = "farfield.authToken";

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

/**
 * Load all connection settings from persistent storage.
 * Returns DEFAULT_SETTINGS for any value that has not been saved yet.
 */
export async function loadSettings(): Promise<ConnectionSettings> {
  const [serverUrl, profileLabel, authToken] = await Promise.all([
    AsyncStorage.getItem(ASYNC_KEY_SERVER_URL),
    AsyncStorage.getItem(ASYNC_KEY_PROFILE_LABEL),
    secureGet(SECURE_KEY_AUTH_TOKEN),
  ]);

  return {
    serverUrl: serverUrl ?? DEFAULT_SETTINGS.serverUrl,
    authToken: authToken ?? DEFAULT_SETTINGS.authToken,
    profileLabel: profileLabel ?? DEFAULT_SETTINGS.profileLabel,
  };
}

/**
 * Persist all connection settings.
 * - serverUrl and profileLabel are written to AsyncStorage.
 * - authToken is written to SecureStore (device-encrypted), or AsyncStorage on web.
 * - Empty strings are treated as "cleared" (delete the key).
 */
export async function saveSettings(
  settings: ConnectionSettings
): Promise<void> {
  const writes: Promise<void>[] = [];

  if (settings.serverUrl) {
    writes.push(
      AsyncStorage.setItem(ASYNC_KEY_SERVER_URL, settings.serverUrl)
    );
  } else {
    writes.push(AsyncStorage.removeItem(ASYNC_KEY_SERVER_URL));
  }

  if (settings.profileLabel) {
    writes.push(
      AsyncStorage.setItem(ASYNC_KEY_PROFILE_LABEL, settings.profileLabel)
    );
  } else {
    writes.push(AsyncStorage.removeItem(ASYNC_KEY_PROFILE_LABEL));
  }

  if (settings.authToken) {
    writes.push(secureSet(SECURE_KEY_AUTH_TOKEN, settings.authToken));
  } else {
    writes.push(secureDelete(SECURE_KEY_AUTH_TOKEN));
  }

  await Promise.all(writes);
}

/**
 * Clear all connection settings from persistent storage.
 */
export async function clearSettings(): Promise<void> {
  await Promise.all([
    AsyncStorage.removeItem(ASYNC_KEY_SERVER_URL),
    AsyncStorage.removeItem(ASYNC_KEY_PROFILE_LABEL),
    secureDelete(SECURE_KEY_AUTH_TOKEN),
  ]);
}

// ---------------------------------------------------------------------------
// Settings change subscriptions
// ---------------------------------------------------------------------------

/** Callback invoked with the latest settings whenever saveSettings() is called. */
export type SettingsChangeListener = (settings: ConnectionSettings) => void;

const _settingsListeners = new Set<SettingsChangeListener>();

/**
 * Subscribe to settings changes.
 *
 * The listener is called synchronously (in the same microtask) after every
 * successful `saveSettings()` call, with the newly saved settings.
 *
 * @returns An unsubscribe function. Call it to remove the listener.
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
 * Persist all connection settings and notify subscribers.
 *
 * Replaces the original saveSettings() — same signature, adds fan-out.
 */
export async function saveSettingsAndNotify(
  settings: ConnectionSettings
): Promise<void> {
  await saveSettings(settings);
  // Notify all listeners after the write resolves
  _settingsListeners.forEach((listener) => {
    try {
      listener(settings);
    } catch (err) {
      // Listener errors must not block other listeners or the caller
      console.warn("[settings] listener threw", err);
    }
  });
}
