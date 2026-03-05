import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import {
  ConnectionProfileId,
  ConnectionProfilesState,
  loadProfilesState,
  saveProfilesStateAndNotify,
} from "@/src/settings";

/**
 * Settings screen — Tab 3
 *
 * Phase 08 profile UX:
 *   - Preset profile switcher (Local / Tailscale)
 *   - Per-profile URL/token editing
 *   - Active profile persisted and broadcast through settings notifications
 */
export default function SettingsScreen() {
  const [profilesState, setProfilesState] = useState<ConnectionProfilesState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedIndicator, setSavedIndicator] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const state = await loadProfilesState();
      if (!cancelled) {
        setProfilesState(state);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const activeProfile = useMemo(() => {
    if (!profilesState) return null;
    return profilesState.profiles[profilesState.activeProfileId];
  }, [profilesState]);

  function switchProfile(profileId: ConnectionProfileId) {
    setProfilesState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        activeProfileId: profileId,
      };
    });
  }

  function updateActiveProfile(
    patch: Partial<{ label: string; serverUrl: string; authToken: string }>
  ) {
    setProfilesState((prev) => {
      if (!prev) return prev;

      const activeId = prev.activeProfileId;
      const current = prev.profiles[activeId];

      return {
        ...prev,
        profiles: {
          ...prev.profiles,
          [activeId]: {
            ...current,
            ...patch,
          },
        },
      };
    });
  }

  function validateState(state: ConnectionProfilesState): string | null {
    const localUrl = state.profiles.local.serverUrl.trim();
    const tailscaleUrl = state.profiles.tailscale.serverUrl.trim();

    if (localUrl.length > 0 && !localUrl.startsWith("http")) {
      return "Local server URL should start with http:// or https://";
    }

    if (tailscaleUrl.length > 0 && !tailscaleUrl.startsWith("http")) {
      return "Tailscale server URL should start with http:// or https://";
    }

    return null;
  }

  const handleSave = async () => {
    if (!profilesState) return;

    const validationError = validateState(profilesState);
    if (validationError) {
      Alert.alert("Invalid URL", validationError);
      return;
    }

    setSaving(true);
    try {
      await saveProfilesStateAndNotify(profilesState);
      setSavedIndicator(true);
      setTimeout(() => setSavedIndicator(false), 2000);
    } catch (err) {
      Alert.alert("Save Error", "Failed to save settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !activeProfile || !profilesState) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>

      <View style={styles.section}>
        <Text style={styles.sectionHeader}>ACTIVE PROFILE</Text>
        <View style={styles.profileSwitchRow}>
          <TouchableOpacity
            style={[
              styles.profileSwitchButton,
              profilesState.activeProfileId === "local" && styles.profileSwitchButtonActive,
            ]}
            onPress={() => switchProfile("local")}
            accessibilityRole="button"
            accessibilityLabel="Switch to local profile"
          >
            <Text
              style={[
                styles.profileSwitchButtonText,
                profilesState.activeProfileId === "local" && styles.profileSwitchButtonTextActive,
              ]}
            >
              Local
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.profileSwitchButton,
              profilesState.activeProfileId === "tailscale" && styles.profileSwitchButtonActive,
            ]}
            onPress={() => switchProfile("tailscale")}
            accessibilityRole="button"
            accessibilityLabel="Switch to tailscale profile"
          >
            <Text
              style={[
                styles.profileSwitchButtonText,
                profilesState.activeProfileId === "tailscale" && styles.profileSwitchButtonTextActive,
              ]}
            >
              Tailscale
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeader}>PROFILE DETAILS</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Label</Text>
          <TextInput
            style={styles.input}
            value={activeProfile.label}
            onChangeText={(label) => updateActiveProfile({ label })}
            placeholder="Profile label"
            placeholderTextColor="#C7C7CC"
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="next"
          />
        </View>
        <View style={[styles.row, styles.rowSpaced]}>
          <Text style={styles.rowLabel}>Server URL</Text>
          <TextInput
            style={styles.input}
            value={activeProfile.serverUrl}
            onChangeText={(serverUrl) => updateActiveProfile({ serverUrl })}
            placeholder="http://100.x.x.x:4311"
            placeholderTextColor="#C7C7CC"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            textContentType="URL"
            returnKeyType="next"
          />
        </View>
        <View style={[styles.row, styles.rowSpaced]}>
          <Text style={styles.rowLabel}>Auth Token</Text>
          <TextInput
            style={styles.input}
            value={activeProfile.authToken}
            onChangeText={(authToken) => updateActiveProfile({ authToken })}
            placeholder="Paste your FARFIELD_AUTH_TOKEN"
            placeholderTextColor="#C7C7CC"
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            textContentType="password"
            returnKeyType="done"
          />
        </View>
      </View>

      <TouchableOpacity
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={saving}
        activeOpacity={0.7}
      >
        {saving ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.saveButtonText}>
            {savedIndicator ? "Saved!" : "Save Settings"}
          </Text>
        )}
      </TouchableOpacity>

      <Text style={styles.hint}>
        Each profile keeps its own URL and token. Saving also updates the active
        connection used by Threads and live updates.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F2F2F7",
  },
  container: {
    flex: 1,
    backgroundColor: "#F2F2F7",
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 24,
    color: "#1C1C1E",
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: "600",
    color: "#8E8E93",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  profileSwitchRow: {
    flexDirection: "row",
    gap: 8,
  },
  profileSwitchButton: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D1D1D6",
    backgroundColor: "#fff",
    paddingVertical: 12,
    alignItems: "center",
  },
  profileSwitchButtonActive: {
    borderColor: "#007AFF",
    backgroundColor: "#EAF3FF",
  },
  profileSwitchButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#3A3A3C",
  },
  profileSwitchButtonTextActive: {
    color: "#0052CC",
  },
  row: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 16,
  },
  rowSpaced: {
    marginTop: 10,
  },
  rowLabel: {
    fontSize: 13,
    color: "#8E8E93",
    marginBottom: 6,
  },
  input: {
    fontSize: 16,
    color: "#1C1C1E",
    padding: 0,
  },
  saveButton: {
    backgroundColor: "#007AFF",
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 16,
    minHeight: 50,
    justifyContent: "center",
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  hint: {
    fontSize: 13,
    color: "#8E8E93",
    lineHeight: 18,
  },
});
