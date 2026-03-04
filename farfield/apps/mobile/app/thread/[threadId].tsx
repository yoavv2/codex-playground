import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";

import { useThread } from "@/src/hooks/useThread";
import type { PendingApproval } from "@/src/api/approvals";
import { FarfieldClientError } from "@/src/api/errors";
import type { ThreadDetailEnvelope } from "@/src/api/threads";

/**
 * Thread Detail screen
 *
 * Phase 04: reads GET /api/threads/:id and GET /api/threads/:id/pending-approvals
 * via the useThread() hook. Renders conversation history and pending approvals
 * in read-only mode — no composer, interrupt, or approve/deny buttons yet
 * (those belong to Phase 05).
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

function TurnCard({ turn, index }: { turn: ThreadDetailEnvelope["thread"]["turns"][number]; index: number }) {
  const text = extractTurnText(turn);
  const startedAt =
    typeof turn.turnStartedAtMs === "number" ? turn.turnStartedAtMs : undefined;

  return (
    <View style={styles.turnCard}>
      <View style={styles.turnCardHeader}>
        <Text style={styles.turnLabel}>Turn {index + 1}</Text>
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
        Approve/deny controls available in Phase 05.
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function ThreadDetailScreen() {
  const { threadId } = useLocalSearchParams<{ threadId: string }>();

  const { threadDetail, pendingApprovals, isLoading, isError, error } = useThread(
    threadId ?? ""
  );

  if (isLoading) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading thread…</Text>
      </View>
    );
  }

  if (isError) {
    const message =
      error instanceof FarfieldClientError
        ? error.message
        : (error?.message ?? "An unknown error occurred.");

    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.label}>Thread ID</Text>
          <Text style={styles.threadId}>{threadId}</Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Could not load thread</Text>
          <Text style={styles.errorBody}>{message}</Text>
        </View>
      </ScrollView>
    );
  }

  const thread = threadDetail?.thread;
  const turns = thread?.turns ?? [];
  const agentId = threadDetail?.agentId;

  const title =
    typeof thread?.title === "string" && thread.title.length > 0
      ? thread.title
      : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
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
      </View>

      {/* Conversation turns */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Conversation
          {turns.length > 0 ? ` (${turns.length} turn${turns.length === 1 ? "" : "s"})` : ""}
        </Text>
        {turns.length > 0 ? (
          turns.map((turn, i) => (
            <TurnCard key={turn.id ?? `turn-${i}`} turn={turn} index={i} />
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No conversation turns yet.</Text>
          </View>
        )}
      </View>

      {/* Pending approvals */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Pending Approvals
          {pendingApprovals.length > 0
            ? ` (${pendingApprovals.length})`
            : ""}
        </Text>
        {pendingApprovals.length > 0 ? (
          pendingApprovals.map((approval) => (
            <ApprovalCard key={approval.requestId} approval={approval} />
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No pending approvals.</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2F2F7",
  },
  content: {
    padding: 20,
    paddingBottom: 40,
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
  header: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 16,
    marginBottom: 20,
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
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1C1C1E",
    marginBottom: 12,
  },
  turnCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  turnCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  turnLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#8E8E93",
  },
  turnMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  turnTime: {
    fontSize: 12,
    color: "#C7C7CC",
  },
  turnStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
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
    fontSize: 11,
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
  emptyCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 16,
  },
  emptyText: {
    fontSize: 14,
    color: "#8E8E93",
    fontStyle: "italic",
  },
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
});
