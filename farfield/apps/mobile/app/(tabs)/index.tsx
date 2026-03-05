import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useFocusEffect } from "expo-router";

import { loadProfilesState, loadSettings } from "@/src/settings";
import { checkHealth } from "@/src/api/health";
import { useLiveUpdates } from "@/src/live/useLiveUpdates";
import type { SseStatus } from "@/src/hooks/useSseConnection";

type HealthStatus = "unknown" | "checking" | "ok" | "error";

// ---------------------------------------------------------------------------
// Live transport status chip — consistent vocabulary with Threads banner
// ---------------------------------------------------------------------------

function liveTransportProps(status: SseStatus): { color: string; label: string } | null {
  switch (status) {
    case "connected":
      return { color: "#34C759", label: "Live updates: connected" };
    case "connecting":
      return { color: "#8E8E93", label: "Live updates: connecting…" };
    case "reconnecting":
      return { color: "#FF9500", label: "Live updates: reconnecting…" };
    case "paused":
      return { color: "#8E8E93", label: "Live updates: paused (app backgrounded)" };
    case "error":
      return { color: "#FF3B30", label: "Live updates: disconnected — check server" };
    case "idle":
    default:
      return null;
  }
}

function LiveTransportRow({ status }: { status: SseStatus }) {
  const props = liveTransportProps(status);
  if (!props) return null;
  return (
    <View style={[styles.liveRow, { backgroundColor: props.color }]}>
      <Text style={styles.liveRowText}>{props.label}</Text>
    </View>
  );
}

/**
 * Connection screen — Tab 1
 *
 * Shows the currently saved server URL and auth token presence,
 * hydrating from persisted settings on every focus (so that changes
 * made in the Settings tab are immediately reflected here).
 *
 * Provides a "Test Connection" button that calls GET /api/health and
 * displays success/failure feedback suitable for setup debugging.
 *
 * Phase 04 will wire: live thread data via TanStack Query.
 */
export default function ConnectionScreen() {
  const [serverUrl, setServerUrl] = useState<string>("");
  const [authToken, setAuthToken] = useState<string>("");
  const [activeProfileLabel, setActiveProfileLabel] = useState<string>("Local");
  const [hasToken, setHasToken] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [healthStatus, setHealthStatus] = useState<HealthStatus>("unknown");
  const [healthMessage, setHealthMessage] = useState<string>("");

  // Live transport status from the app-wide SSE connection
  const { status: sseStatus } = useLiveUpdates();

  // Hydrate from persisted storage every time the screen gains focus.
  // This ensures values updated in the Settings tab are reflected here immediately.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const [settings, profilesState] = await Promise.all([
          loadSettings(),
          loadProfilesState(),
        ]);

        const activeProfile = profilesState.profiles[profilesState.activeProfileId];
        if (!cancelled) {
          setServerUrl(settings.serverUrl);
          setAuthToken(settings.authToken);
          setActiveProfileLabel(activeProfile.label);
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

  const handleTestConnection = useCallback(async () => {
    setHealthStatus("checking");
    setHealthMessage("Contacting server...");

    const result = await checkHealth(serverUrl, authToken || undefined);

    setHealthStatus(result.ok ? "ok" : "error");
    setHealthMessage(result.message);
  }, [serverUrl, authToken]);

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
        <Text style={styles.cardLabel}>Active Profile</Text>
        <Text style={styles.cardValue}>{activeProfileLabel}</Text>
      </View>

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
              : healthStatus === "error"
                ? styles.healthMessageError
                : styles.healthMessageChecking,
          ]}
        >
          <Text style={styles.healthMessageText}>{healthMessage}</Text>
        </View>
      ) : null}

      <TouchableOpacity
        style={[
          styles.testButton,
          (!isConfigured || healthStatus === "checking") &&
            styles.testButtonDisabled,
        ]}
        onPress={handleTestConnection}
        disabled={!isConfigured || healthStatus === "checking"}
        activeOpacity={0.7}
      >
        {healthStatus === "checking" ? (
          <ActivityIndicator color="#007AFF" size="small" />
        ) : (
          <Text style={styles.testButtonText}>Test Connection</Text>
        )}
      </TouchableOpacity>

      {!isConfigured && (
        <Text style={styles.hint}>
          Configure your server URL in the Settings tab, then use "Test
          Connection" to verify the server is reachable.
        </Text>
      )}

      {/* Live transport status — shows SSE connection health for runtime troubleshooting */}
      <LiveTransportRow status={sseStatus} />

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
  healthMessageChecking: {
    backgroundColor: "#FFF3CD",
  },
  healthMessageText: {
    fontSize: 14,
    color: "#1C1C1E",
    lineHeight: 20,
  },
  testButton: {
    borderColor: "#007AFF",
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 16,
    minHeight: 50,
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  testButtonDisabled: {
    borderColor: "#C7C7CC",
  },
  testButtonText: {
    color: "#007AFF",
    fontSize: 16,
    fontWeight: "600",
  },
  hint: {
    fontSize: 14,
    color: "#8E8E93",
    lineHeight: 20,
  },
  // Live transport status row
  liveRow: {
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 4,
    alignSelf: "stretch",
  },
  liveRowText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#fff",
  },
});
