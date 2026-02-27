import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useFocusEffect } from "expo-router";

import { loadSettings } from "@/src/settings";

type HealthStatus = "unknown" | "checking" | "ok" | "error";

/**
 * Connection screen — Tab 1
 *
 * Shows the currently saved server URL and auth token presence,
 * hydrating from persisted settings on every focus (so that changes
 * made in Settings tab are immediately reflected here).
 *
 * Phase 03-03 health-check action is implemented below.
 * Phase 04 will wire: live connection status via TanStack Query.
 */
export default function ConnectionScreen() {
  const [serverUrl, setServerUrl] = useState<string>("");
  const [hasToken, setHasToken] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [healthStatus, setHealthStatus] = useState<HealthStatus>("unknown");
  const [healthMessage, setHealthMessage] = useState<string>("");

  // Hydrate from persisted storage every time the screen gains focus.
  // This ensures values updated in Settings are reflected here immediately.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const settings = await loadSettings();
        if (!cancelled) {
          setServerUrl(settings.serverUrl);
          setHasToken(Boolean(settings.authToken));
          // Reset health status when settings change
          setHealthStatus("unknown");
          setHealthMessage("");
          setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const isConfigured = Boolean(serverUrl);

  const statusDotStyle =
    healthStatus === "ok"
      ? styles.statusConnected
      : healthStatus === "error"
        ? styles.statusError
        : healthStatus === "checking"
          ? styles.statusChecking
          : styles.statusDisconnected;

  const statusText =
    healthStatus === "ok"
      ? "Connected"
      : healthStatus === "error"
        ? "Unreachable"
        : healthStatus === "checking"
          ? "Checking..."
          : "Not connected";

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Connection</Text>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Server URL</Text>
        <Text style={[styles.cardValue, !serverUrl && styles.cardValueEmpty]}>
          {serverUrl || "Not configured"}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Auth Token</Text>
        <Text style={[styles.cardValue, !hasToken && styles.cardValueEmpty]}>
          {hasToken ? "Configured" : "Not configured"}
        </Text>
      </View>

      <View style={styles.statusRow}>
        <View style={[styles.statusDot, statusDotStyle]} />
        <Text style={styles.statusText}>{statusText}</Text>
      </View>

      {healthMessage ? (
        <View
          style={[
            styles.healthMessageBox,
            healthStatus === "ok"
              ? styles.healthMessageOk
              : styles.healthMessageError,
          ]}
        >
          <Text style={styles.healthMessageText}>{healthMessage}</Text>
        </View>
      ) : null}

      {!isConfigured && (
        <Text style={styles.hint}>
          Configure your server URL and auth token in the Settings tab.
        </Text>
      )}

      <StatusBar style="auto" />
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
    padding: 20,
    backgroundColor: "#F2F2F7",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 24,
    color: "#1C1C1E",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
  },
  cardLabel: {
    fontSize: 13,
    color: "#8E8E93",
    marginBottom: 4,
  },
  cardValue: {
    fontSize: 16,
    color: "#1C1C1E",
  },
  cardValueEmpty: {
    color: "#C7C7CC",
    fontStyle: "italic",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 16,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusDisconnected: {
    backgroundColor: "#C7C7CC",
  },
  statusConnected: {
    backgroundColor: "#34C759",
  },
  statusError: {
    backgroundColor: "#FF3B30",
  },
  statusChecking: {
    backgroundColor: "#FF9500",
  },
  statusText: {
    fontSize: 15,
    color: "#8E8E93",
  },
  healthMessageBox: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  healthMessageOk: {
    backgroundColor: "#D4EDDA",
  },
  healthMessageError: {
    backgroundColor: "#F8D7DA",
  },
  healthMessageText: {
    fontSize: 14,
    color: "#1C1C1E",
    lineHeight: 20,
  },
  hint: {
    fontSize: 14,
    color: "#8E8E93",
    lineHeight: 20,
  },
});
