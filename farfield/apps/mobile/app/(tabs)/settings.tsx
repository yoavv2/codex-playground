import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { loadSettings, saveSettingsAndNotify } from "@/src/settings";

/**
 * Settings screen — Tab 3
 *
 * Allows the user to configure and persist:
 *   - Server URL (stored via AsyncStorage)
 *   - Auth Token (stored via expo-secure-store, device-encrypted)
 *
 * Phase 04 will add: model selection, theme preferences.
 */
export default function SettingsScreen() {
  const [serverUrl, setServerUrl] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedIndicator, setSavedIndicator] = useState(false);

  // Hydrate from persisted storage on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const settings = await loadSettings();
      if (!cancelled) {
        setServerUrl(settings.serverUrl);
        setAuthToken(settings.authToken);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async () => {
    const trimmedUrl = serverUrl.trim();
    const trimmedToken = authToken.trim();

    if (trimmedUrl && !trimmedUrl.startsWith("http")) {
      Alert.alert(
        "Invalid URL",
        "Server URL should start with http:// or https://"
      );
      return;
    }

    setSaving(true);
    try {
      await saveSettingsAndNotify({
        serverUrl: trimmedUrl,
        authToken: trimmedToken,
      });
      setSavedIndicator(true);
      setTimeout(() => setSavedIndicator(false), 2000);
    } catch (err) {
      Alert.alert("Save Error", "Failed to save settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
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
        <Text style={styles.sectionHeader}>SERVER</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Server URL</Text>
          <TextInput
            style={styles.input}
            value={serverUrl}
            onChangeText={setServerUrl}
            placeholder="http://100.x.x.x:4311"
            placeholderTextColor="#C7C7CC"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            textContentType="URL"
            returnKeyType="done"
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeader}>AUTHENTICATION</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Auth Token</Text>
          <TextInput
            style={styles.input}
            value={authToken}
            onChangeText={setAuthToken}
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
        Server URL and auth token are used by the Connection screen to reach
        your Farfield instance over Tailscale.
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
    marginBottom: 24,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: "600",
    color: "#8E8E93",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  row: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 16,
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
