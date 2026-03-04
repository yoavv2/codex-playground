import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";

import { useThreads } from "@/src/hooks/useThreads";
import type { ThreadListItem } from "@/src/api/threads";
import { FarfieldClientError, NoServerUrlError } from "@/src/api/errors";

/**
 * Threads screen — Tab 2
 *
 * Phase 04: fetches the real thread list from GET /api/threads via useThreads().
 * Read-only view — no composer or action buttons yet (Phase 05).
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getThreadTitle(thread: ThreadListItem): string {
  // Prefer an explicit title field (present on ThreadConversationState items).
  if ("title" in thread && typeof thread.title === "string" && thread.title.length > 0) {
    return thread.title;
  }
  // Fall back to thread id so there is always something to display.
  return thread.id;
}

function getThreadPreview(thread: ThreadListItem): string {
  if ("preview" in thread && typeof thread.preview === "string") {
    return thread.preview;
  }
  return "";
}

function formatRelativeTime(epochMs: number | undefined): string {
  if (!epochMs) return "";
  const delta = Date.now() - epochMs;
  const mins = Math.floor(delta / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function errorMessage(error: Error | null): string {
  if (!error) return "An unknown error occurred.";
  if (error instanceof NoServerUrlError) {
    return "No server URL configured. Please set one in Settings.";
  }
  if (error instanceof FarfieldClientError) {
    return error.message;
  }
  return error.message;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ThreadItem({ thread }: { thread: ThreadListItem }) {
  function handlePress() {
    router.push(`/thread/${thread.id}`);
  }

  const title = getThreadTitle(thread);
  const preview = getThreadPreview(thread);
  const updatedAt = "updatedAt" in thread ? (thread.updatedAt as number | undefined) : undefined;

  return (
    <TouchableOpacity style={styles.item} onPress={handlePress} activeOpacity={0.7}>
      <View style={styles.itemHeader}>
        <Text style={styles.itemTitle} numberOfLines={1}>
          {title}
        </Text>
        {updatedAt ? (
          <Text style={styles.itemTime}>{formatRelativeTime(updatedAt)}</Text>
        ) : null}
      </View>
      {preview ? (
        <Text style={styles.itemPreview} numberOfLines={2}>
          {preview}
        </Text>
      ) : null}
      <Text style={styles.itemId} numberOfLines={1}>
        {thread.id}
      </Text>
    </TouchableOpacity>
  );
}

function EmptyState() {
  return (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>No threads yet</Text>
      <Text style={styles.emptyBody}>
        Start a new Codex session on your Mac to see threads here.
      </Text>
    </View>
  );
}

function ErrorState({ error }: { error: Error | null }) {
  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorTitle}>Could not load threads</Text>
      <Text style={styles.errorBody}>{errorMessage(error)}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function ThreadsScreen() {
  const { threads, isLoading, isEmpty, isError, error, refetch } = useThreads();

  if (isLoading) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading threads…</Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Threads</Text>
        <ErrorState error={error} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Threads</Text>
      {threads && threads.length > 0 ? (
        <Text style={styles.subtitle}>
          {threads.length} {threads.length === 1 ? "thread" : "threads"}
        </Text>
      ) : null}
      <FlatList
        data={threads ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ThreadItem thread={item} />}
        contentContainerStyle={isEmpty ? styles.emptyList : styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={isEmpty ? <EmptyState /> : null}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refetch}
            tintColor="#007AFF"
          />
        }
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2F2F7",
    padding: 20,
  },
  centeredContainer: {
    flex: 1,
    backgroundColor: "#F2F2F7",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
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
  loadingText: {
    fontSize: 14,
    color: "#8E8E93",
  },
  list: {
    paddingBottom: 20,
  },
  emptyList: {
    flex: 1,
    justifyContent: "center",
  },
  item: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 16,
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1C1C1E",
    flex: 1,
    marginRight: 8,
  },
  itemTime: {
    fontSize: 12,
    color: "#8E8E93",
    flexShrink: 0,
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
  emptyContainer: {
    alignItems: "center",
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1C1C1E",
    marginBottom: 8,
  },
  emptyBody: {
    fontSize: 14,
    color: "#8E8E93",
    textAlign: "center",
    lineHeight: 20,
  },
  errorContainer: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 16,
    marginTop: 8,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FF3B30",
    marginBottom: 6,
  },
  errorBody: {
    fontSize: 14,
    color: "#3A3A3C",
    lineHeight: 20,
  },
});
