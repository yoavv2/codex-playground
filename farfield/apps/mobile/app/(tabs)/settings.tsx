import { StyleSheet, Text, View } from "react-native";

/**
 * Settings screen — Tab 3
 *
 * Phase 03 skeleton: shows settings field placeholders.
 * Phase 03-03 will wire: TextInput fields for server URL and auth token,
 *   persisted via AsyncStorage (URL) and expo-secure-store (token).
 */
export default function SettingsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>

      <View style={styles.section}>
        <Text style={styles.sectionHeader}>SERVER</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Server URL</Text>
          <Text style={styles.rowPlaceholder}>
            {/* 03-03: TextInput bound to AsyncStorage */}
            e.g. http://100.x.x.x:4000
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeader}>AUTHENTICATION</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Auth Token</Text>
          <Text style={styles.rowPlaceholder}>
            {/* 03-03: SecureTextEntry TextInput bound to expo-secure-store */}
            Not set
          </Text>
        </View>
      </View>

      <Text style={styles.hint}>
        Persistent storage and input fields will be wired in Phase 03-03.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
    fontSize: 16,
    color: "#1C1C1E",
    marginBottom: 4,
  },
  rowPlaceholder: {
    fontSize: 14,
    color: "#C7C7CC",
    fontStyle: "italic",
  },
  hint: {
    fontSize: 13,
    color: "#8E8E93",
    lineHeight: 18,
  },
});
