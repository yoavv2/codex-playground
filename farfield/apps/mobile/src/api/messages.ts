/**
 * Typed client methods for the Farfield message-send endpoint.
 *
 * Endpoint: POST /api/threads/:id/messages
 *
 * Phase 04 contract: sendMessage() sends a user message to a thread and
 * validates the server's { ok, threadId } envelope before returning.
 *
 * All transport / auth / error normalisation is delegated to fetchJson() in
 * ./client so this module owns only the request shape and response typing.
 */

import { z } from "zod";

import { fetchJson } from "./client";

// ---------------------------------------------------------------------------
// Request / response schemas
// ---------------------------------------------------------------------------

/** Mirror of server SendMessageBodySchema (http-schemas.ts). */
const SendMessageBodySchema = z
  .object({
    text: z.string().min(1),
    ownerClientId: z.string().optional(),
    cwd: z.string().optional(),
    isSteering: z.boolean().optional(),
  })
  .strict();

export type SendMessageBody = z.infer<typeof SendMessageBodySchema>;

/** Validated server response envelope. */
const SendMessageResponseSchema = z
  .object({
    ok: z.literal(true),
    threadId: z.string(),
  })
  .passthrough();

export type SendMessageResponse = z.infer<typeof SendMessageResponseSchema>;

// ---------------------------------------------------------------------------
// Client method
// ---------------------------------------------------------------------------

/**
 * Send a user message to a Farfield thread.
 *
 * @param threadId - Target thread identifier.
 * @param body     - Message payload (text is required; other fields optional).
 * @returns Validated server acknowledgement including the thread ID.
 * @throws {NoServerUrlError}       If serverUrl is not configured.
 * @throws {UnauthorizedError}      If the server returns 401 or 403.
 * @throws {ServerUnreachableError} On network failure.
 * @throws {RequestTimeoutError}    On timeout.
 * @throws {HttpError}              On non-2xx response (other than auth).
 * @throws {SchemaMismatchError}    If the response envelope is malformed.
 */
export async function sendMessage(
  threadId: string,
  body: SendMessageBody
): Promise<SendMessageResponse> {
  return fetchJson(`/api/threads/${encodeURIComponent(threadId)}/messages`, {
    method: "POST",
    body,
    schema: SendMessageResponseSchema,
  });
}
