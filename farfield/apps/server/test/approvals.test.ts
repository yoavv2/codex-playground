import { describe, expect, it } from "vitest";
import { parseThreadConversationState } from "@farfield/protocol";
import { listPendingApprovals, mapApprovalDecisionToResponse } from "../src/approvals.js";

describe("approval normalization", () => {
  it("extracts pending approvals from thread requests", () => {
    const conversationState = parseThreadConversationState({
      id: "thread-1",
      turns: [],
      requests: [
        {
          method: "item/tool/requestUserInput",
          id: 1,
          params: {
            threadId: "thread-1",
            turnId: "turn-1",
            itemId: "item-1",
            questions: []
          }
        },
        {
          method: "item/commandExecution/requestApproval",
          id: 2,
          params: {
            threadId: "thread-1",
            turnId: "turn-2",
            itemId: "item-2",
            command: "curl https://example.com",
            cwd: "/tmp",
            reason: "network required"
          }
        },
        {
          method: "item/fileChange/requestApproval",
          id: 3,
          params: {
            threadId: "thread-1",
            turnId: "turn-2",
            itemId: "item-3",
            reason: "write file"
          }
        },
        {
          method: "applyPatchApproval",
          id: 4,
          params: {
            callId: "call-4",
            conversationId: "thread-1",
            fileChanges: {},
            reason: null
          }
        }
      ]
    });

    const approvals = listPendingApprovals(conversationState);

    expect(approvals).toHaveLength(3);
    expect(approvals[0]).toMatchObject({
      requestId: 2,
      type: "command"
    });
    expect(approvals[1]).toMatchObject({
      requestId: 3,
      type: "file-change"
    });
    expect(approvals[2]).toMatchObject({
      requestId: 4,
      type: "apply-patch"
    });
  });

  it("maps approve and deny decisions for each approval request method", () => {
    expect(
      mapApprovalDecisionToResponse("item/commandExecution/requestApproval", "approve")
    ).toEqual({ decision: "accept" });
    expect(
      mapApprovalDecisionToResponse("item/fileChange/requestApproval", "deny")
    ).toEqual({ decision: "decline" });
    expect(
      mapApprovalDecisionToResponse("execCommandApproval", "approve")
    ).toEqual({ decision: "approved" });
    expect(
      mapApprovalDecisionToResponse("applyPatchApproval", "deny")
    ).toEqual({ decision: "denied" });
  });
});
