import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";

/**
 * Threads screen — Tab 2
 *
 * Phase 03 skeleton: renders placeholder thread items.
 * Phase 04 will wire: TanStack Query fetching GET /api/threads, real thread list.
 */

type PlaceholderThread = {
  id: string;
  title: string;
  preview: string;
};

const PLACEHOLDER_THREADS: PlaceholderThread[] = [
  {
    id: "thread-001",
    title: "Refactor auth middleware",
    preview: "Codex is working on extracting bearer token validation...",
  },
  {
    id: "thread-002",
    title: "Write unit tests for approval API",
    preview: "Generating test cases for pending-approvals endpoints...",
  },
  {
    id: "thread-003",
    title: "Fix TypeScript strict errors",
    preview: "Resolving 4 type errors in apps/mobile/app...",
  },
];

function ThreadItem({ thread }: { thread: PlaceholderThread }) {
  function handlePress() {
    router.push(`/thread/${thread.id}`);
  }

  return (
    <TouchableOpacity style={styles.item} onPress={handlePress} activeOpacity={0.7}>
      <Text style={styles.itemTitle} numberOfLines={1}>
        {thread.title}
      </Text>
      <Text style={styles.itemPreview} numberOfLines={2}>
        {thread.preview}
      </Text>
      <Text style={styles.itemId}>{thread.id}</Text>
    </TouchableOpacity>
  );
}

export default function ThreadsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Threads</Text>
      <Text style={styles.subtitle}>
        {/* 04: replace with real thread count from API */}
        {PLACEHOLDER_THREADS.length} placeholder threads (Phase 04 wires real data)
      </Text>
      <FlatList
        data={PLACEHOLDER_THREADS}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ThreadItem thread={item} />}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
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
    marginBottom: 4,
    color: "#1C1C1E",
  },
  subtitle: {
    fontSize: 13,
    color: "#8E8E93",
    marginBottom: 16,
  },
  list: {
    paddingBottom: 20,
  },
  item: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 16,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1C1C1E",
    marginBottom: 4,
  },
  itemPreview: {
    fontSize: 14,
    color: "#3A3A3C",
    lineHeight: 20,
    marginBottom: 6,
  },
  itemId: {
    fontSize: 11,
    color: "#C7C7CC",
    fontFamily: "monospace" as const,
  },
  separator: {
    height: 10,
  },
});
