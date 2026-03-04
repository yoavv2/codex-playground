/**
 * Read-side API client for pending approval operations.
 *
 * Covers:
 *   GET /api/threads/:id/pending-approvals — list pending approvals for a thread
 *
 * The server's approval shape is defined in apps/server/src/approvals.ts.
 * We mirror the PendingApproval interface here as a local Zod schema for
 * runtime validation, since the server types are not re-exported from
 * @farfield/protocol.
 *
 * This module is intentionally read-only for Phase 04.
 * The POST /api/threads/:id/pending-approvals/respond endpoint is reserved
 * for Phase 05 (interaction controls).
 */

import { z } from "zod";

import { fetchJson } from "./client";
import { SchemaMismatchError } from "./errors";

// ---------------------------------------------------------------------------
// Local Zod schemas mirroring server/src/approvals.ts shape
// ---------------------------------------------------------------------------

const PendingApprovalTypeSchema = z.union([
  z.literal("command"),
  z.literal("file-change"),
  z.literal("apply-patch"),
]);

const RequestMethodSchema = z.union([
  z.literal("item/commandExecution/requestApproval"),
  z.literal("item/fileChange/requestApproval"),
  z.literal("execCommandApproval"),
  z.literal("applyPatchApproval"),
]);

const PendingApprovalSchema = z
  .object({
    requestId: z.number().int().nonnegative(),
    requestMethod: RequestMethodSchema,
    type: PendingApprovalTypeSchema,
    status: z.literal("pending"),
    threadId: z.string().min(1),
    turnId: z.union([z.string(), z.null()]),
    itemId: z.string().min(1),
    approvalId: z.union([z.string(), z.null()]),
    summary: z.string(),
    detail: z.record(z.union([z.string(), z.array(z.string()), z.null()])),
  })
  .passthrough();

const PendingApprovalsEnvelopeSchema = z.object({
  ok: z.literal(true),
  threadId: z.string().min(1),
  ownerClientId: z.union([z.string(), z.null()]).optional(),
  pendingApprovals: z.array(PendingApprovalSchema),
  liveStateError: z.union([z.string(), z.null()]).optional(),
});

// ---------------------------------------------------------------------------
// Inferred types (exported for hook and UI use)
// ---------------------------------------------------------------------------

export type PendingApproval = z.infer<typeof PendingApprovalSchema>;
export type PendingApprovalsEnvelope = z.infer<typeof PendingApprovalsEnvelopeSchema>;

// ---------------------------------------------------------------------------
// Read function
// ---------------------------------------------------------------------------

/**
 * Fetch the list of pending approvals for a thread from
 * GET /api/threads/:id/pending-approvals.
 *
 * Returns an empty array when the agent does not support live state reads
 * (the server returns 400 in that case, which fetchJson() normalizes to
 * HttpError — callers can handle and treat as an empty state).
 *
 * @param threadId - The thread identifier.
 * @returns Validated envelope with `pendingApprovals` array.
 * @throws {FarfieldClientError} on transport or validation failure.
 */
function parse<S extends z.ZodTypeAny>(
  schema: S,
  raw: unknown,
  context: string
): z.output<S> {
  const result = schema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => {
      const p =
        issue.path.length === 0
          ? "<root>"
          : issue.path
              .map((s) => (typeof s === "number" ? `[${s}]` : s))
              .join(".")
              .replace(".[", "[");
      return `${p}: ${issue.message}`;
    });
    throw new SchemaMismatchError(context, issues);
  }
  return result.data;
}

export async function listPendingApprovals(
  threadId: string
): Promise<PendingApprovalsEnvelope> {
  const raw = await fetchJson(
    `/api/threads/${encodeURIComponent(threadId)}/pending-approvals`
  );
  return parse(
    PendingApprovalsEnvelopeSchema,
    raw,
    `GET /api/threads/${threadId}/pending-approvals`
  );
}
