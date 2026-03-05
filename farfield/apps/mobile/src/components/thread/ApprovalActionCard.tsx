import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import type { PendingApproval } from "@/src/api/approvals";

interface ApprovalActionCardProps {
  approval: PendingApproval;
  isPending: boolean;
  errorText: string | null;
  onApprove: (approval: PendingApproval) => void;
  onDeny: (approval: PendingApproval) => void;
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

function detailValue(detail: PendingApproval["detail"], key: string): string | null {
  const value = detail[key];
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.join("\n");
  }
  return null;
}

export function ApprovalActionCard({
  approval,
  isPending,
  errorText,
  onApprove,
  onDeny,
}: ApprovalActionCardProps) {
  const commandText = detailValue(approval.detail, "command");
  const reasonText = detailValue(approval.detail, "reason");

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.typeBadge}>
          <Text style={styles.typeBadgeText}>{approvalTypeLabel(approval.type)}</Text>
        </View>
        <Text style={styles.requestMeta}>{`#${approval.requestId}`}</Text>
      </View>

      <Text style={styles.summary}>{approval.summary}</Text>

      {commandText ? (
        <Text style={styles.commandText} numberOfLines={6} selectable>
          {commandText}
        </Text>
      ) : null}

      {reasonText ? <Text style={styles.reasonText}>{reasonText}</Text> : null}

      {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.actionButton, styles.denyButton, isPending && styles.actionButtonDisabled]}
          onPress={() => onDeny(approval)}
          disabled={isPending}
          accessibilityRole="button"
          accessibilityLabel={`Deny request ${approval.requestId}`}
        >
          {isPending ? (
            <ActivityIndicator size="small" color="#C0342B" />
          ) : (
            <Text style={[styles.actionButtonText, styles.denyButtonText]}>Deny</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.approveButton, isPending && styles.actionButtonDisabled]}
          onPress={() => onApprove(approval)}
          disabled={isPending}
          accessibilityRole="button"
          accessibilityLabel={`Approve request ${approval.requestId}`}
        >
          {isPending ? (
            <ActivityIndicator size="small" color="#0A7A30" />
          ) : (
            <Text style={[styles.actionButtonText, styles.approveButtonText]}>Approve</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFF8EC",
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#FFD060",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  typeBadge: {
    backgroundColor: "#FF9500",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fff",
  },
  requestMeta: {
    fontSize: 11,
    color: "#8E8E93",
    fontWeight: "600",
  },
  summary: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1C1C1E",
    marginBottom: 6,
  },
  commandText: {
    fontSize: 12,
    color: "#3A3A3C",
    fontFamily: "monospace",
    backgroundColor: "#F2F2F7",
    padding: 8,
    borderRadius: 6,
    marginBottom: 6,
  },
  reasonText: {
    fontSize: 13,
    color: "#8E8E93",
    fontStyle: "italic",
    marginBottom: 8,
  },
  errorText: {
    fontSize: 12,
    color: "#C0342B",
    marginBottom: 8,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 2,
  },
  actionButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  actionButtonDisabled: {
    opacity: 0.7,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: "700",
  },
  denyButton: {
    backgroundColor: "#FFF1F0",
    borderColor: "#F6B2AD",
  },
  denyButtonText: {
    color: "#C0342B",
  },
  approveButton: {
    backgroundColor: "#EAF9EF",
    borderColor: "#A8DFC0",
  },
  approveButtonText: {
    color: "#0A7A30",
  },
});
