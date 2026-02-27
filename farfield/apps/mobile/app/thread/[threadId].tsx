import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";

/**
 * Thread Detail screen
 *
 * Receives the `threadId` route parameter from Expo Router.
 * Navigated to via: router.push(`/thread/${threadId}`)
 *
 * Phase 03 skeleton: displays the threadId and placeholder message blocks.
 * Phase 04 will wire: TanStack Query fetching GET /api/threads/:id/messages,
 *   approval prompt detection and respond UI.
 */
export default function ThreadDetailScreen() {
  const { threadId } = useLocalSearchParams<{ threadId: string }>();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.label}>Thread ID</Text>
        <Text style={styles.threadId}>{threadId}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Messages</Text>
        <Text style={styles.placeholder}>
          {/* 04: replace with message list from GET /api/threads/:id/messages */}
          No messages yet — Phase 04 will fetch and render real Codex output here.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Pending Approvals</Text>
        <Text style={styles.placeholder}>
          {/* 04: replace with GET /api/threads/:id/pending-approvals */}
          No pending approvals — Phase 04 will surface command/file/apply-patch
          approval prompts here with approve/deny actions.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2F2F7",
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 16,
    marginBottom: 20,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#8E8E93",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  threadId: {
    fontSize: 16,
    color: "#1C1C1E",
    fontFamily: "monospace" as const,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1C1C1E",
    marginBottom: 12,
  },
  placeholder: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 16,
    fontSize: 14,
    color: "#8E8E93",
    lineHeight: 20,
    fontStyle: "italic",
  },
});
