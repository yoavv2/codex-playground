import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useState, useRef } from "react";
import { useLocalSearchParams } from "expo-router";

import { useThread } from "@/src/hooks/useThread";
import { useSendMessage } from "@/src/hooks/useThreadMutations";
import { useLiveUpdates } from "@/src/live/useLiveUpdates";
import type { PendingApproval } from "@/src/api/approvals";
import { FarfieldClientError } from "@/src/api/errors";
import type { ThreadDetailEnvelope } from "@/src/api/threads";

/**
 * Thread Detail screen — MVP chat surface (Phase 05)
 *
 * Reads GET /api/threads/:id and GET /api/threads/:id/pending-approvals via
 * useThread(). Renders a scrollable conversation history with pull-to-refresh,
 * an always-visible message composer wired to useSendMessage(), and pending
 * approvals read-out below the turns.
 *
 * Intentionally simple: plain text only, monospaced for code-like content.
 * No markdown rendering, syntax highlighting, or collaboration-mode controls.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function extractTurnText(turn: ThreadDetailEnvelope["thread"]["turns"][number]): string {
  const parts: string[] = [];
  for (const item of turn.items) {
    if (
      item.type === "userMessage" ||
      item.type === "steeringUserMessage"
    ) {
      for (const part of item.content ?? []) {
        if (part.type === "text" && typeof part.text === "string") {
          parts.push(part.text);
        }
      }
    } else if (item.type === "agentMessage" && typeof item.text === "string") {
      parts.push(item.text);
    } else if (item.type === "plan" && typeof item.text === "string") {
      parts.push(`[Plan] ${item.text}`);
    } else if (item.type === "error" && typeof item.message === "string") {
      parts.push(`[Error] ${item.message}`);
    }
  }
  return parts.join("\n\n").trim();
}

/** True for turns that originated from the local user. */
function isUserTurn(turn: ThreadDetailEnvelope["thread"]["turns"][number]): boolean {
  return turn.items.some(
    (item) => item.type === "userMessage" || item.type === "steeringUserMessage"
  );
}

function approvalTypeLabel(type: PendingApproval["type"]): string {
  switch (type) {
    case "command":
      return "Command";
    case "file-change":
      return "File Change";
    case "apply-patch":
      return "Apply Patch";
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

type Turn = ThreadDetailEnvelope["thread"]["turns"][number];

function TurnCard({ turn }: { turn: Turn }) {
  const text = extractTurnText(turn);
  const startedAt =
    typeof turn.turnStartedAtMs === "number" ? turn.turnStartedAtMs : undefined;
  const fromUser = isUserTurn(turn);

  return (
    <View style={[styles.turnCard, fromUser ? styles.turnCardUser : styles.turnCardAgent]}>
      <View style={styles.turnCardHeader}>
        <Text style={[styles.turnRole, fromUser ? styles.turnRoleUser : styles.turnRoleAgent]}>
          {fromUser ? "You" : "Agent"}
        </Text>
        <View style={styles.turnMeta}>
          {startedAt ? (
            <Text style={styles.turnTime}>{formatRelativeTime(startedAt)}</Text>
          ) : null}
          <View
            style={[
              styles.turnStatusBadge,
              turn.status === "completed"
                ? styles.statusCompleted
                : turn.status === "inProgress"
                  ? styles.statusInProgress
                  : styles.statusOther,
            ]}
          >
            <Text style={styles.turnStatusText}>{turn.status}</Text>
          </View>
        </View>
      </View>
      {text ? (
        <Text style={styles.turnText}>{text}</Text>
      ) : (
        <Text style={styles.turnEmpty}>(no text content)</Text>
      )}
    </View>
  );
}

function ApprovalCard({ approval }: { approval: PendingApproval }) {
  return (
    <View style={styles.approvalCard}>
      <View style={styles.approvalHeader}>
        <View style={styles.approvalTypeBadge}>
          <Text style={styles.approvalTypeBadgeText}>{approvalTypeLabel(approval.type)}</Text>
        </View>
      </View>
      <Text style={styles.approvalSummary}>{approval.summary}</Text>
      {approval.detail.command ? (
        <Text style={styles.approvalDetail} numberOfLines={3}>
          {String(approval.detail.command)}
        </Text>
      ) : null}
      {approval.detail.reason ? (
        <Text style={styles.approvalReason}>{String(approval.detail.reason)}</Text>
      ) : null}
      <Text style={styles.approvalNote}>
        Approve/deny controls available in Phase 06.
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Composer
// ---------------------------------------------------------------------------

interface ComposerProps {
  threadId: string;
  onSent: () => void;
}

function Composer({ threadId, onSent }: ComposerProps) {
  const [draft, setDraft] = useState("");
  const sendMutation = useSendMessage();
  const isPending = sendMutation.isPending;

  function handleSend() {
    const text = draft.trim();
    if (!text || isPending) return;

    sendMutation.mutate(
      { threadId, body: { text } },
      {
        onSuccess: () => {
          setDraft("");
          onSent();
        },
      }
    );
  }

  return (
    <View style={styles.composerContainer}>
      {sendMutation.isError ? (
        <Text style={styles.sendError} numberOfLines={2}>
          {sendMutation.error instanceof FarfieldClientError
            ? sendMutation.error.message
            : "Failed to send. Please try again."}
        </Text>
      ) : null}
      <View style={styles.composerRow}>
        <TextInput
          style={styles.composerInput}
          value={draft}
          onChangeText={setDraft}
          placeholder="Message…"
          placeholderTextColor="#C7C7CC"
          multiline
          maxLength={4000}
          editable={!isPending}
          returnKeyType="default"
          blurOnSubmit={false}
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!draft.trim() || isPending) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!draft.trim() || isPending}
          accessibilityLabel="Send message"
          accessibilityRole="button"
        >
          {isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.sendButtonText}>Send</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Live sync status chip — lightweight transport indicator for thread detail
// ---------------------------------------------------------------------------

import type { SseStatus } from "@/src/hooks/useSseConnection";

function liveSyncChipProps(status: SseStatus): { color: string; label: string } | null {
  switch (status) {
    case "connected":
      return { color: "#34C759", label: "Live" };
    case "reconnecting":
      return { color: "#FF9500", label: "Reconnecting — pull to refresh" };
    case "paused":
      return { color: "#8E8E93", label: "Paused" };
    case "error":
      return { color: "#FF9500", label: "Disconnected — pull to refresh" };
    case "connecting":
      return { color: "#8E8E93", label: "Connecting…" };
    case "idle":
    default:
      return null;
  }
}

function LiveSyncChip({ status }: { status: SseStatus }) {
  const props = liveSyncChipProps(status);
  if (!props) return null;
  return (
    <View style={[styles.liveSyncChip, { backgroundColor: props.color }]}>
      <Text style={styles.liveSyncChipText}>{props.label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen list item types (module-level so they can be referenced by useRef)
// ---------------------------------------------------------------------------

type ListItem =
  | { kind: "turn"; turn: Turn }
  | { kind: "approval"; approval: PendingApproval }
  | { kind: "empty-turns" }
  | { kind: "empty-approvals" }
  | { kind: "approvals-header" };

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function ThreadDetailScreen() {
  const { threadId } = useLocalSearchParams<{ threadId: string }>();
  const flatListRef = useRef<FlatList<ListItem>>(null);

  const {
    threadDetail,
    pendingApprovals,
    isLoading,
    isRefreshing,
    isError,
    error,
    refetch,
  } = useThread(threadId ?? "");

  const { status: sseStatus } = useLiveUpdates();

  // Scroll to bottom helper — used after a successful send
  function scrollToBottom() {
    flatListRef.current?.scrollToEnd({ animated: true });
  }

  // Initial full-screen load
  if (isLoading) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading thread…</Text>
      </View>
    );
  }

  // Error with no cached data
  if (isError && !threadDetail) {
    const message =
      error instanceof FarfieldClientError
        ? error.message
        : (error?.message ?? "An unknown error occurred.");

    return (
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.errorScreen}>
          <View style={styles.header}>
            <Text style={styles.label}>Thread ID</Text>
            <Text style={styles.threadId}>{threadId}</Text>
          </View>
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>Could not load thread</Text>
            <Text style={styles.errorBody}>{message}</Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  }

  const thread = threadDetail?.thread;
  const turns: Turn[] = thread?.turns ?? [];
  const agentId = threadDetail?.agentId;
  const title =
    typeof thread?.title === "string" && thread.title.length > 0
      ? thread.title
      : null;

  // Build FlatList items: turns first, then approval cards, then empty states
  const listItems: ListItem[] = [];

  if (turns.length === 0) {
    listItems.push({ kind: "empty-turns" });
  } else {
    for (const turn of turns) {
      listItems.push({ kind: "turn", turn });
    }
  }

  listItems.push({ kind: "approvals-header" });

  if (pendingApprovals.length === 0) {
    listItems.push({ kind: "empty-approvals" });
  } else {
    for (const approval of pendingApprovals) {
      listItems.push({ kind: "approval", approval });
    }
  }

  function renderItem({ item }: { item: ListItem }) {
    switch (item.kind) {
      case "turn":
        return <TurnCard turn={item.turn} />;
      case "approval":
        return <ApprovalCard approval={item.approval} />;
      case "empty-turns":
        return (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No conversation turns yet.</Text>
          </View>
        );
      case "approvals-header":
        return (
          <Text style={styles.sectionTitle}>
            Pending Approvals
            {pendingApprovals.length > 0 ? ` (${pendingApprovals.length})` : ""}
          </Text>
        );
      case "empty-approvals":
        return (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No pending approvals.</Text>
          </View>
        );
    }
  }

  const ListHeader = (
    <View>
      {/* Thread header metadata */}
      <View style={styles.header}>
        {title ? <Text style={styles.threadTitle}>{title}</Text> : null}
        <Text style={styles.label}>Thread ID</Text>
        <Text style={styles.threadId}>{threadId}</Text>
        {agentId ? (
          <>
            <Text style={[styles.label, styles.labelSpaced]}>Agent</Text>
            <Text style={styles.agentId}>{agentId}</Text>
          </>
        ) : null}
        {/* Live-sync status chip — pull to refresh is always available as fallback */}
        <LiveSyncChip status={sseStatus} />
      </View>

      {/* Conversation section header */}
      <Text style={styles.sectionTitle}>
        Conversation
        {turns.length > 0 ? ` (${turns.length} turn${turns.length === 1 ? "" : "s"})` : ""}
      </Text>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
    >
      <FlatList
        ref={flatListRef}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={listItems}
        keyExtractor={(item, i) => {
          if (item.kind === "turn") return item.turn.id ?? `turn-${i}`;
          if (item.kind === "approval") return `approval-${item.approval.requestId}`;
          return item.kind;
        }}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refetch}
            tintColor="#007AFF"
          />
        }
        showsVerticalScrollIndicator
      />
      <Composer threadId={threadId ?? ""} onSent={scrollToBottom} />
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: "#F2F2F7",
  },
  list: {
    flex: 1,
    backgroundColor: "#F2F2F7",
  },
  listContent: {
    padding: 16,
    paddingBottom: 8,
  },
  centeredContainer: {
    flex: 1,
    backgroundColor: "#F2F2F7",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: "#8E8E93",
  },
  errorScreen: {
    flex: 1,
    padding: 16,
  },
  header: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
  },
  threadTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1C1C1E",
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#8E8E93",
    letterSpacing: 0.5,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  labelSpaced: {
    marginTop: 12,
  },
  threadId: {
    fontSize: 13,
    color: "#1C1C1E",
    fontFamily: "monospace" as const,
  },
  agentId: {
    fontSize: 14,
    color: "#1C1C1E",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1C1C1E",
    marginBottom: 10,
    marginTop: 4,
  },
  // Turn cards — differentiate user vs agent
  turnCard: {
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  turnCardUser: {
    backgroundColor: "#D6EDFF",
    alignSelf: "flex-end",
    maxWidth: "90%",
  },
  turnCardAgent: {
    backgroundColor: "#fff",
    alignSelf: "flex-start",
    maxWidth: "90%",
    width: "100%",
  },
  turnCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  turnRole: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  turnRoleUser: {
    color: "#0A84FF",
  },
  turnRoleAgent: {
    color: "#636366",
  },
  turnMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  turnTime: {
    fontSize: 11,
    color: "#C7C7CC",
  },
  turnStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusCompleted: {
    backgroundColor: "#D1F0D5",
  },
  statusInProgress: {
    backgroundColor: "#FFF3CC",
  },
  statusOther: {
    backgroundColor: "#F2F2F7",
  },
  turnStatusText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#3A3A3C",
  },
  turnText: {
    fontSize: 14,
    color: "#1C1C1E",
    lineHeight: 20,
  },
  turnEmpty: {
    fontSize: 13,
    color: "#C7C7CC",
    fontStyle: "italic",
  },
  // Approval cards
  approvalCard: {
    backgroundColor: "#FFF8EC",
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#FFD060",
  },
  approvalHeader: {
    flexDirection: "row",
    marginBottom: 8,
  },
  approvalTypeBadge: {
    backgroundColor: "#FF9500",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  approvalTypeBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fff",
  },
  approvalSummary: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1C1C1E",
    marginBottom: 6,
  },
  approvalDetail: {
    fontSize: 12,
    color: "#3A3A3C",
    fontFamily: "monospace" as const,
    backgroundColor: "#F2F2F7",
    padding: 8,
    borderRadius: 6,
    marginBottom: 6,
  },
  approvalReason: {
    fontSize: 13,
    color: "#8E8E93",
    fontStyle: "italic",
    marginBottom: 6,
  },
  approvalNote: {
    fontSize: 12,
    color: "#C7C7CC",
    marginTop: 4,
  },
  // Empty states
  emptyCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: "#8E8E93",
    fontStyle: "italic",
  },
  // Error state
  errorContainer: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 16,
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
  // Composer
  composerContainer: {
    backgroundColor: "#fff",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#C6C6C8",
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: Platform.OS === "ios" ? 28 : 12,
  },
  composerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  composerInput: {
    flex: 1,
    minHeight: 36,
    maxHeight: 120,
    backgroundColor: "#F2F2F7",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 8,
    fontSize: 15,
    color: "#1C1C1E",
    lineHeight: 20,
  },
  sendButton: {
    backgroundColor: "#007AFF",
    borderRadius: 18,
    height: 36,
    minWidth: 60,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  sendButtonDisabled: {
    backgroundColor: "#C7C7CC",
  },
  sendButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
  sendError: {
    fontSize: 12,
    color: "#FF3B30",
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  // Live sync status chip
  liveSyncChip: {
    alignSelf: "flex-start",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 10,
  },
  liveSyncChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#fff",
  },
});
