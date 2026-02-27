import type { ThreadConversationState, ThreadRequest, ThreadRequestResponsePayload } from "@farfield/protocol";

export type ApprovalDecision = "approve" | "deny";

export type PendingApprovalType = "command" | "file-change" | "apply-patch";

export interface PendingApproval {
  requestId: number;
  requestMethod:
    | "item/commandExecution/requestApproval"
    | "item/fileChange/requestApproval"
    | "execCommandApproval"
    | "applyPatchApproval";
  type: PendingApprovalType;
  status: "pending";
  threadId: string;
  turnId: string | null;
  itemId: string;
  approvalId: string | null;
  summary: string;
  detail: Record<string, string | string[] | null>;
}

function normalizeCommandSummary(command: string | null, fallback: string): string {
  const normalized = command?.trim() ?? "";
  return normalized.length > 0 ? normalized : fallback;
}

function mapApprovalRequest(request: ThreadRequest): PendingApproval | null {
  if (request.method === "item/tool/requestUserInput") {
    return null;
  }

  if (request.method === "item/commandExecution/requestApproval") {
    return {
      requestId: request.id,
      requestMethod: request.method,
      type: "command",
      status: "pending",
      threadId: request.params.threadId,
      turnId: request.params.turnId,
      itemId: request.params.itemId,
      approvalId: request.params.approvalId ?? null,
      summary: normalizeCommandSummary(request.params.command ?? null, "Command approval requested"),
      detail: {
        command: request.params.command ?? null,
        cwd: request.params.cwd ?? null,
        reason: request.params.reason ?? null,
        commandActions: request.params.commandActions
          ? JSON.stringify(request.params.commandActions)
          : null,
        proposedExecpolicyAmendment: request.params.proposedExecpolicyAmendment
          ? JSON.stringify(request.params.proposedExecpolicyAmendment)
          : null
      }
    };
  }

  if (request.method === "item/fileChange/requestApproval") {
    return {
      requestId: request.id,
      requestMethod: request.method,
      type: "file-change",
      status: "pending",
      threadId: request.params.threadId,
      turnId: request.params.turnId,
      itemId: request.params.itemId,
      approvalId: null,
      summary: "File change approval requested",
      detail: {
        reason: request.params.reason ?? null,
        grantRoot: request.params.grantRoot ?? null
      }
    };
  }

  if (request.method === "execCommandApproval") {
    return {
      requestId: request.id,
      requestMethod: request.method,
      type: "command",
      status: "pending",
      threadId: request.params.conversationId,
      turnId: null,
      itemId: request.params.callId,
      approvalId: request.params.approvalId ?? null,
      summary: request.params.command.join(" "),
      detail: {
        command: JSON.stringify(request.params.command),
        cwd: request.params.cwd,
        reason: request.params.reason ?? null,
        parsedCmd: JSON.stringify(request.params.parsedCmd)
      }
    };
  }

  return {
    requestId: request.id,
    requestMethod: request.method,
    type: "apply-patch",
    status: "pending",
    threadId: request.params.conversationId,
    turnId: null,
    itemId: request.params.callId,
    approvalId: null,
    summary: "Patch approval requested",
    detail: {
      reason: request.params.reason ?? null,
      grantRoot: request.params.grantRoot ?? null,
      fileChanges: JSON.stringify(request.params.fileChanges)
    }
  };
}

export function listPendingApprovals(conversationState: ThreadConversationState | null): PendingApproval[] {
  if (!conversationState) {
    return [];
  }

  const approvals: PendingApproval[] = [];
  for (const request of conversationState.requests) {
    const mapped = mapApprovalRequest(request);
    if (mapped) {
      approvals.push(mapped);
    }
  }

  return approvals;
}

export function mapApprovalDecisionToResponse(
  requestMethod: PendingApproval["requestMethod"],
  decision: ApprovalDecision
): ThreadRequestResponsePayload {
  if (requestMethod === "item/commandExecution/requestApproval") {
    return {
      decision: decision === "approve" ? "accept" : "decline"
    };
  }

  if (requestMethod === "item/fileChange/requestApproval") {
    return {
      decision: decision === "approve" ? "accept" : "decline"
    };
  }

  if (requestMethod === "execCommandApproval") {
    return {
      decision: decision === "approve" ? "approved" : "denied"
    };
  }

  return {
    decision: decision === "approve" ? "approved" : "denied"
  };
}
