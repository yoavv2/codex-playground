/**
 * Settings persistence layer for @farfield/mobile.
 *
 * Storage strategy (per Phase 03 decision lock):
 *   - authToken       → expo-secure-store  (device-encrypted; sensitive)
 *   - serverUrl       → AsyncStorage       (non-secret; readable profile config)
 *   - profileLabel    → AsyncStorage       (non-secret; optional display label)
 *
 * Usage:
 *   const settings = await loadSettings();
 *   await saveSettings({ serverUrl, authToken, profileLabel });
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

import { ConnectionSettings, DEFAULT_SETTINGS } from "./types";

// AsyncStorage keys (non-secret values)
const ASYNC_KEY_SERVER_URL = "farfield:serverUrl";
const ASYNC_KEY_PROFILE_LABEL = "farfield:profileLabel";

// SecureStore key (sensitive: auth token)
const SECURE_KEY_AUTH_TOKEN = "farfield:authToken";

/**
 * Load all connection settings from persistent storage.
 * Returns DEFAULT_SETTINGS for any value that has not been saved yet.
 */
export async function loadSettings(): Promise<ConnectionSettings> {
  const [serverUrl, profileLabel, authToken] = await Promise.all([
    AsyncStorage.getItem(ASYNC_KEY_SERVER_URL),
    AsyncStorage.getItem(ASYNC_KEY_PROFILE_LABEL),
    SecureStore.getItemAsync(SECURE_KEY_AUTH_TOKEN),
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
 * - authToken is written to SecureStore (device-encrypted).
 * - Empty strings are treated as "cleared" (delete the key).
 */
export async function saveSettings(
  settings: ConnectionSettings
): Promise<void> {
  const asyncWrites: Promise<void>[] = [];

  if (settings.serverUrl) {
    asyncWrites.push(
      AsyncStorage.setItem(ASYNC_KEY_SERVER_URL, settings.serverUrl)
    );
  } else {
    asyncWrites.push(AsyncStorage.removeItem(ASYNC_KEY_SERVER_URL));
  }

  if (settings.profileLabel) {
    asyncWrites.push(
      AsyncStorage.setItem(ASYNC_KEY_PROFILE_LABEL, settings.profileLabel)
    );
  } else {
    asyncWrites.push(AsyncStorage.removeItem(ASYNC_KEY_PROFILE_LABEL));
  }

  const secureWrite: Promise<void> = settings.authToken
    ? SecureStore.setItemAsync(SECURE_KEY_AUTH_TOKEN, settings.authToken)
    : SecureStore.deleteItemAsync(SECURE_KEY_AUTH_TOKEN);

  await Promise.all([...asyncWrites, secureWrite]);
}

/**
 * Clear all connection settings from persistent storage.
 */
export async function clearSettings(): Promise<void> {
  await Promise.all([
    AsyncStorage.removeMany([ASYNC_KEY_SERVER_URL, ASYNC_KEY_PROFILE_LABEL]),
    SecureStore.deleteItemAsync(SECURE_KEY_AUTH_TOKEN),
  ]);
}
