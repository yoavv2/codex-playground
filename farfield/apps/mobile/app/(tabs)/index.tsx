import { StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";

/**
 * Connection screen — Tab 1
 *
 * Phase 03 skeleton: shows connection state placeholder.
 * Phase 03-03 will wire: persisted server URL / auth token, /api/health ping button.
 * Phase 04 will wire: live connection status via TanStack Query.
 */
export default function ConnectionScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Connection</Text>
      <View style={styles.placeholder}>
        <Text style={styles.placeholderLabel}>Server URL</Text>
        <Text style={styles.placeholderValue}>Not configured</Text>
      </View>
      <View style={styles.placeholder}>
        <Text style={styles.placeholderLabel}>Auth Token</Text>
        <Text style={styles.placeholderValue}>Not configured</Text>
      </View>
      <View style={styles.statusRow}>
        <View style={[styles.statusDot, styles.statusDisconnected]} />
        <Text style={styles.statusText}>Disconnected</Text>
      </View>
      <Text style={styles.hint}>
        {/* 03-03: wire up Settings to read persisted URL and token, */}
        {/* then call /api/health to populate connection status. */}
        Configure server URL and auth token in Settings.
      </Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
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
  placeholder: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
  },
  placeholderLabel: {
    fontSize: 13,
    color: "#8E8E93",
    marginBottom: 4,
  },
  placeholderValue: {
    fontSize: 16,
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
  statusText: {
    fontSize: 15,
    color: "#8E8E93",
  },
  hint: {
    fontSize: 14,
    color: "#8E8E93",
    lineHeight: 20,
  },
});
