import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";

import { useThreads } from "@/src/hooks/useThreads";
import type { ThreadListItem } from "@/src/api/threads";
import {
  FarfieldClientError,
  NoServerUrlError,
  UnauthorizedError,
  ServerUnreachableError,
  RequestTimeoutError,
} from "@/src/api/errors";
import { useState, useMemo } from "react";

import { useLiveUpdates } from "@/src/live/useLiveUpdates";

/**
 * Threads screen — Tab 2
 *
 * Phase 05: MVP browse surface with local search, richer list rows,
 * and a compact connection banner driven by REST query state.
 * Phase 06: Connection banner augmented with SSE live-update status.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getThreadTitle(thread: ThreadListItem): string {
  if ("title" in thread && typeof thread.title === "string" && thread.title.length > 0) {
    return thread.title;
  }
  return thread.id;
}

function getThreadPreview(thread: ThreadListItem): string {
  if ("preview" in thread && typeof thread.preview === "string") {
    return thread.preview;
  }
  return "";
}

function getThreadSource(thread: ThreadListItem): string {
  if ("source" in thread && typeof thread.source === "string" && thread.source.length > 0) {
    return thread.source;
  }
  return "codex";
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

/**
 * Returns true if `thread` matches the given filter string.
 * Matches against title, id, and preview (case-insensitive).
 */
function threadMatchesFilter(thread: ThreadListItem, filter: string): boolean {
  if (!filter.trim()) return true;
  const q = filter.toLowerCase();
  const title = getThreadTitle(thread).toLowerCase();
  const preview = getThreadPreview(thread).toLowerCase();
  const id = thread.id.toLowerCase();
  return title.includes(q) || id.includes(q) || preview.includes(q);
}

// ---------------------------------------------------------------------------
// Connection banner helpers
// ---------------------------------------------------------------------------

type ConnectionStatus =
  | "live-connected"
  | "connected"
  | "live-reconnecting"
  | "live-error"
  | "auth-failed"
  | "server-unreachable"
  | "timeout"
  | "configure-server"
  | "unknown-error"
  | "idle";

import type { SseStatus } from "@/src/hooks/useSseConnection";

function deriveConnectionStatus(
  isError: boolean,
  error: Error | null,
  hasData: boolean,
  sseStatus: SseStatus
): ConnectionStatus {
  // REST errors take priority — surface the actionable problem first
  if (isError) {
    if (error instanceof NoServerUrlError) return "configure-server";
    if (error instanceof UnauthorizedError) return "auth-failed";
    if (error instanceof ServerUnreachableError) return "server-unreachable";
    if (error instanceof RequestTimeoutError) return "timeout";
    return "unknown-error";
  }

  // SSE status — show live connection health when REST is working
  if (sseStatus === "connected") {
    return "live-connected";
  }
  if (sseStatus === "reconnecting") {
    return "live-reconnecting";
  }
  if (sseStatus === "error") {
    return "live-error";
  }

  return hasData ? "connected" : "idle";
}

function connectionBannerProps(status: ConnectionStatus): {
  color: string;
  label: string;
} | null {
  switch (status) {
    case "live-connected":
      return { color: "#34C759", label: "Live — connected" };
    case "connected":
      return { color: "#34C759", label: "Connected" };
    case "live-reconnecting":
      return { color: "#FF9500", label: "Live updates reconnecting…" };
    case "live-error":
      return { color: "#FF9500", label: "Live updates disconnected — pull to refresh" };
    case "auth-failed":
      return { color: "#FF3B30", label: "Auth failed — check your token in Settings" };
    case "server-unreachable":
      return { color: "#FF9500", label: "Server unreachable — check URL and network" };
    case "timeout":
      return { color: "#FF9500", label: "Request timed out — server may be slow" };
    case "configure-server":
      return { color: "#8E8E93", label: "No server configured — go to Settings" };
    case "unknown-error":
      return { color: "#FF3B30", label: "Could not reach server" };
    case "idle":
      return null;
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ConnectionBanner({ status }: { status: ConnectionStatus }) {
  const props = connectionBannerProps(status);
  if (!props) return null;

  return (
    <View style={[styles.banner, { backgroundColor: props.color }]}>
      <Text style={styles.bannerText}>{props.label}</Text>
    </View>
  );
}

function SourceBadge({ source }: { source: string }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{source}</Text>
    </View>
  );
}

function ThreadItem({ thread }: { thread: ThreadListItem }) {
  function handlePress() {
    router.push(`/thread/${thread.id}`);
  }

  const title = getThreadTitle(thread);
  const preview = getThreadPreview(thread);
  const source = getThreadSource(thread);
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
      <View style={styles.itemFooter}>
        <Text style={styles.itemId} numberOfLines={1}>
          {thread.id}
        </Text>
        <SourceBadge source={source} />
      </View>
    </TouchableOpacity>
  );
}

function NoThreadsEmptyState() {
  return (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>No threads yet</Text>
      <Text style={styles.emptyBody}>
        Start a new Codex session on your Mac to see threads here.
      </Text>
    </View>
  );
}

function NoResultsEmptyState({ filter }: { filter: string }) {
  return (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>No results</Text>
      <Text style={styles.emptyBody}>
        No threads match &ldquo;{filter}&rdquo;. Try a different search term.
      </Text>
    </View>
  );
}

function ErrorState({ error }: { error: Error | null }) {
  function getMessage() {
    if (!error) return "An unknown error occurred.";
    if (error instanceof NoServerUrlError) {
      return "No server URL configured. Please set one in Settings.";
    }
    return error.message;
  }

  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorTitle}>Could not load threads</Text>
      <Text style={styles.errorBody}>{getMessage()}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function ThreadsScreen() {
  const {
    sortedThreads,
    isFirstLoad,
    isRefreshing,
    isEmpty,
    isError,
    error,
    refetch,
  } = useThreads();

  // SSE live-update connection status for banner augmentation
  const { status: sseStatus } = useLiveUpdates();

  const [filter, setFilter] = useState("");

  const filteredThreads = useMemo(() => {
    if (!sortedThreads) return undefined;
    return sortedThreads.filter((t) => threadMatchesFilter(t, filter));
  }, [sortedThreads, filter]);

  const hasData = !!(sortedThreads && sortedThreads.length > 0);
  const hasFilter = filter.trim().length > 0;
  const connectionStatus = deriveConnectionStatus(isError, error, hasData, sseStatus);

  // Full-screen spinner only on first load (no cached data yet).
  if (isFirstLoad) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading threads…</Text>
      </View>
    );
  }

  // Determine empty list component based on context.
  function renderEmptyList() {
    if (isEmpty && !hasFilter) return <NoThreadsEmptyState />;
    if (hasFilter && filteredThreads?.length === 0) {
      return <NoResultsEmptyState filter={filter} />;
    }
    return null;
  }

  const isListEmpty =
    (isEmpty && !hasFilter) || (hasFilter && (filteredThreads?.length ?? 0) === 0);

  return (
    <View style={styles.container}>
      {/* Header */}
      <Text style={styles.title}>Threads</Text>

      {/* Connection banner — compact REST-derived status above the list */}
      <ConnectionBanner status={connectionStatus} />

      {/* Error state (no data + error) */}
      {isError && !hasData ? (
        <ErrorState error={error} />
      ) : (
        <>
          {/* Search bar */}
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search threads…"
              placeholderTextColor="#8E8E93"
              value={filter}
              onChangeText={setFilter}
              clearButtonMode="while-editing"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
          </View>

          {/* Thread count / filter summary */}
          {sortedThreads && sortedThreads.length > 0 ? (
            <Text style={styles.subtitle}>
              {hasFilter
                ? `${filteredThreads?.length ?? 0} of ${sortedThreads.length} ${
                    sortedThreads.length === 1 ? "thread" : "threads"
                  }`
                : `${sortedThreads.length} ${sortedThreads.length === 1 ? "thread" : "threads"}`}
            </Text>
          ) : null}

          <FlatList
            data={filteredThreads ?? []}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <ThreadItem thread={item} />}
            contentContainerStyle={isListEmpty ? styles.emptyList : styles.list}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListEmptyComponent={renderEmptyList()}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={refetch}
                tintColor="#007AFF"
              />
            }
          />
        </>
      )}
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
    paddingTop: 20,
    paddingHorizontal: 20,
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
    marginBottom: 8,
    color: "#1C1C1E",
  },
  subtitle: {
    fontSize: 13,
    color: "#8E8E93",
    marginBottom: 12,
  },
  loadingText: {
    fontSize: 14,
    color: "#8E8E93",
  },
  // Connection banner
  banner: {
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 12,
    alignSelf: "flex-start",
  },
  bannerText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#fff",
  },
  // Search
  searchRow: {
    marginBottom: 8,
  },
  searchInput: {
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: "#1C1C1E",
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  // List
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
  itemFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  itemId: {
    fontSize: 11,
    color: "#C7C7CC",
    fontFamily: "monospace" as const,
    flex: 1,
    marginRight: 8,
  },
  // Source badge
  badge: {
    backgroundColor: "#E5E5EA",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#3A3A3C",
    textTransform: "lowercase" as const,
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
