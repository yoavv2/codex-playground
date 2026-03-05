/**
 * Read-side API client for thread live-state operations.
 *
 * Covers:
 *   GET /api/threads/:id/live-state — conversation state + pending requests
 *
 * This module also exposes helper utilities for extracting pending
 * request_user_input prompts from conversation state.
 */

import { z } from "zod";
import {
  ThreadConversationStateSchema,
  UserInputQuestionSchema,
  type ThreadConversationState,
} from "@farfield/protocol";

import { fetchJson } from "./client";
import { SchemaMismatchError } from "./errors";

// ---------------------------------------------------------------------------
// Envelope schema
// ---------------------------------------------------------------------------

const LiveStateErrorSchema = z
  .object({
    kind: z.literal("reductionFailed"),
    message: z.string(),
    eventIndex: z.union([z.number().int(), z.null()]),
    patchIndex: z.union([z.number().int(), z.null()]),
  })
  .passthrough();

const ThreadLiveStateEnvelopeSchema = z
  .object({
    ok: z.literal(true),
    threadId: z.string(),
    ownerClientId: z.union([z.string(), z.null()]),
    conversationState: z.union([ThreadConversationStateSchema, z.null()]),
    liveStateError: z.union([LiveStateErrorSchema, z.null()]).optional(),
  })
  .passthrough();

export type ThreadLiveStateEnvelope = z.infer<typeof ThreadLiveStateEnvelopeSchema>;
export type UserInputQuestion = z.infer<typeof UserInputQuestionSchema>;

export interface PendingUserInputRequest {
  requestId: number;
  threadId: string;
  turnId: string;
  itemId: string;
  questions: UserInputQuestion[];
}

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

/**
 * Fetch the live thread state from GET /api/threads/:id/live-state.
 */
export async function readThreadLiveState(
  threadId: string
): Promise<ThreadLiveStateEnvelope> {
  const raw = await fetchJson(`/api/threads/${encodeURIComponent(threadId)}/live-state`);
  return parse(ThreadLiveStateEnvelopeSchema, raw, `GET /api/threads/${threadId}/live-state`);
}

/**
 * Extract unresolved request_user_input requests from a conversation state.
 */
export function listPendingUserInputRequests(
  conversationState: ThreadConversationState | null
): PendingUserInputRequest[] {
  if (!conversationState) {
    return [];
  }

  const pending: PendingUserInputRequest[] = [];
  for (const request of conversationState.requests) {
    if (request.method !== "item/tool/requestUserInput") {
      continue;
    }
    if (request.completed) {
      continue;
    }

    pending.push({
      requestId: request.id,
      threadId: request.params.threadId,
      turnId: request.params.turnId,
      itemId: request.params.itemId,
      questions: request.params.questions,
    });
  }

  return pending;
}
