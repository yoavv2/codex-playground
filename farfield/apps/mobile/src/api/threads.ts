/**
 * Read-side API client for thread operations.
 *
 * Covers:
 *   GET /api/threads          — list all threads
 *   GET /api/threads/:id      — read a single thread (full conversation state)
 *
 * Both functions use the shared fetchJson() transport from ./client so auth,
 * timeout, and error normalization are consistent across all endpoint modules.
 *
 * Response payloads are runtime-validated with @farfield/protocol schemas before
 * being returned to callers. A failed validation throws SchemaMismatchError.
 */

import { z } from "zod";
import {
  AppServerThreadListItemSchema,
  ThreadConversationStateSchema,
} from "@farfield/protocol";

import { fetchJson } from "./client";
import { SchemaMismatchError } from "./errors";

// ---------------------------------------------------------------------------
// Local envelope schemas
//
// NOTE: We use z.object() directly rather than .and() intersections because
// ZodIntersection has type-level incompatibilities with the ZodSchema<T>
// constraint in fetchJson(). Flat z.object() schemas compose cleanly.
// ---------------------------------------------------------------------------

/**
 * Envelope wrapping the list-threads response from the Farfield server.
 * The server returns { ok: true, data: [...], nextCursor }.
 */
const ThreadListEnvelopeSchema = z.object({
  ok: z.literal(true),
  data: z.array(AppServerThreadListItemSchema),
  nextCursor: z.union([z.string(), z.null()]).optional(),
});

/**
 * Envelope wrapping the read-thread response.
 * The server returns { ok: true, agentId, thread: <ThreadConversationState> }.
 */
const ThreadDetailEnvelopeSchema = z.object({
  ok: z.literal(true),
  agentId: z.string().min(1),
  thread: ThreadConversationStateSchema,
});

// ---------------------------------------------------------------------------
// Inferred types (exported for hook and UI use)
// ---------------------------------------------------------------------------

export type ThreadListEnvelope = z.infer<typeof ThreadListEnvelopeSchema>;
export type ThreadDetailEnvelope = z.infer<typeof ThreadDetailEnvelopeSchema>;
export type ThreadListItem = z.infer<typeof AppServerThreadListItemSchema>;

// ---------------------------------------------------------------------------
// Read functions
// ---------------------------------------------------------------------------

/**
 * Parse a raw value with a Zod schema, throwing SchemaMismatchError on failure.
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

/**
 * Fetch the full list of threads from GET /api/threads.
 *
 * @returns Validated thread list envelope.
 * @throws {FarfieldClientError} on any transport or validation failure.
 */
export async function listThreads(): Promise<ThreadListEnvelope> {
  const raw = await fetchJson("/api/threads");
  return parse(ThreadListEnvelopeSchema, raw, "GET /api/threads");
}

/**
 * Fetch a single thread's full conversation state from GET /api/threads/:id.
 *
 * @param threadId - The thread identifier.
 * @returns Validated thread detail envelope with agentId and conversation state.
 * @throws {FarfieldClientError} on any transport or validation failure.
 */
export async function readThread(threadId: string): Promise<ThreadDetailEnvelope> {
  const raw = await fetchJson(`/api/threads/${encodeURIComponent(threadId)}`);
  return parse(ThreadDetailEnvelopeSchema, raw, `GET /api/threads/${threadId}`);
}
