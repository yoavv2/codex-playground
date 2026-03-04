/**
 * Typed client methods for Farfield thread action endpoints.
 *
 * Covers:
 *   - POST /api/threads/:id/interrupt
 *   - POST /api/threads/:id/collaboration-mode
 *   - POST /api/threads/:id/pending-approvals/respond
 *
 * All transport / auth / error normalisation is delegated to fetchJson() in
 * ./client. Request shapes mirror the server's http-schemas.ts contracts.
 */

import { z } from "zod";

import { fetchJson } from "./client";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** CollaborationMode shape mirroring @farfield/protocol CollaborationModeSchema. */
const CollaborationModeSchema = z
  .object({
    mode: z.string().min(1),
    settings: z
      .object({
        model: z.string().nullable().optional(),
        reasoning_effort: z.string().nullable().optional(),
        developer_instructions: z.union([z.string(), z.null()]).optional(),
      })
      .passthrough(),
  })
  .passthrough();

export type CollaborationMode = z.infer<typeof CollaborationModeSchema>;

// ---------------------------------------------------------------------------
// Interrupt
// ---------------------------------------------------------------------------

/** Mirror of server InterruptBodySchema. */
const InterruptBodySchema = z
  .object({
    ownerClientId: z.string().optional(),
  })
  .strict();

export type InterruptBody = z.infer<typeof InterruptBodySchema>;

/** Validated interrupt response envelope. */
const InterruptResponseSchema = z
  .object({
    ok: z.literal(true),
    threadId: z.string(),
  })
  .passthrough();

export type InterruptResponse = z.infer<typeof InterruptResponseSchema>;

/**
 * Interrupt an in-progress turn on a Farfield thread.
 *
 * @param threadId - Target thread identifier.
 * @param body     - Optional ownerClientId passthrough.
 * @returns Validated server acknowledgement including the thread ID.
 */
export async function interruptThread(
  threadId: string,
  body: InterruptBody = {}
): Promise<InterruptResponse> {
  return fetchJson(`/api/threads/${encodeURIComponent(threadId)}/interrupt`, {
    method: "POST",
    body,
    schema: InterruptResponseSchema,
  });
}

// ---------------------------------------------------------------------------
// Collaboration mode
// ---------------------------------------------------------------------------

/** Mirror of server SetModeBodySchema. */
const SetCollaborationModeBodySchema = z
  .object({
    collaborationMode: CollaborationModeSchema,
    ownerClientId: z.string().optional(),
  })
  .strict();

export type SetCollaborationModeBody = z.infer<typeof SetCollaborationModeBodySchema>;

/** Validated collaboration-mode response envelope. */
const SetCollaborationModeResponseSchema = z
  .object({
    ok: z.literal(true),
    threadId: z.string(),
    ownerClientId: z.string().nullable().optional(),
  })
  .passthrough();

export type SetCollaborationModeResponse = z.infer<typeof SetCollaborationModeResponseSchema>;

/**
 * Change the collaboration mode for a Farfield thread.
 *
 * @param threadId - Target thread identifier.
 * @param body     - New collaboration mode and optional ownerClientId.
 * @returns Validated server acknowledgement including thread and owner IDs.
 */
export async function setCollaborationMode(
  threadId: string,
  body: SetCollaborationModeBody
): Promise<SetCollaborationModeResponse> {
  return fetchJson(
    `/api/threads/${encodeURIComponent(threadId)}/collaboration-mode`,
    {
      method: "POST",
      body,
      schema: SetCollaborationModeResponseSchema,
    }
  );
}

// ---------------------------------------------------------------------------
// Approval response
// ---------------------------------------------------------------------------

/** Approval decision values mirroring server SubmitApprovalDecisionBodySchema. */
export type ApprovalDecision = "approve" | "deny";

/** Mirror of server SubmitApprovalDecisionBodySchema. */
const RespondToApprovalBodySchema = z
  .object({
    requestId: z.number().int().nonnegative(),
    decision: z.enum(["approve", "deny"]),
    ownerClientId: z.string().optional(),
  })
  .strict();

export type RespondToApprovalBody = z.infer<typeof RespondToApprovalBodySchema>;

/** Validated approval-response envelope. */
const RespondToApprovalResponseSchema = z
  .object({
    ok: z.literal(true),
    threadId: z.string(),
    requestId: z.number().int().nonnegative(),
    ownerClientId: z.string().nullable().optional(),
    approvalType: z.string().optional(),
    decision: z.enum(["approve", "deny"]),
  })
  .passthrough();

export type RespondToApprovalResponse = z.infer<typeof RespondToApprovalResponseSchema>;

/**
 * Submit an approve/deny decision for a pending approval request.
 *
 * @param threadId - Thread that owns the pending approval.
 * @param body     - requestId, decision ("approve" | "deny"), optional ownerClientId.
 * @returns Validated server acknowledgement including thread, request, and decision.
 */
export async function respondToApproval(
  threadId: string,
  body: RespondToApprovalBody
): Promise<RespondToApprovalResponse> {
  return fetchJson(
    `/api/threads/${encodeURIComponent(threadId)}/pending-approvals/respond`,
    {
      method: "POST",
      body,
      schema: RespondToApprovalResponseSchema,
    }
  );
}
