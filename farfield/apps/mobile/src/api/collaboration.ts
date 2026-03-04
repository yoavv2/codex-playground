/**
 * Read-side API client for collaboration modes.
 *
 * Covers:
 *   GET /api/collaboration-modes — list all available collaboration modes
 *
 * Uses @farfield/protocol's AppServerCollaborationModeListResponseSchema for the
 * data array, wrapping it in a local envelope schema for the server's ok: true
 * outer shape.
 */

import { z } from "zod";
import { AppServerCollaborationModeListItemSchema } from "@farfield/protocol";

import { fetchJson } from "./client";
import { SchemaMismatchError } from "./errors";

// ---------------------------------------------------------------------------
// Local envelope schema
//
// NOTE: Uses z.object() directly rather than .and() to avoid ZodIntersection
// type-level incompatibilities with the ZodSchema<T> constraint in fetchJson().
// ---------------------------------------------------------------------------

const CollaborationModeListEnvelopeSchema = z.object({
  ok: z.literal(true),
  data: z.array(AppServerCollaborationModeListItemSchema),
});

// ---------------------------------------------------------------------------
// Inferred types (exported for hook and UI use)
// ---------------------------------------------------------------------------

export type CollaborationModeListEnvelope = z.infer<
  typeof CollaborationModeListEnvelopeSchema
>;

export type CollaborationModeListItem = z.infer<typeof AppServerCollaborationModeListItemSchema>;

// ---------------------------------------------------------------------------
// Read function
// ---------------------------------------------------------------------------

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
 * Fetch the list of available collaboration modes from
 * GET /api/collaboration-modes.
 *
 * Returns an empty `data` array when the connected agent does not support
 * collaboration modes (the server always responds 200 in that case).
 *
 * @returns Validated envelope with `data` array of collaboration mode items.
 * @throws {FarfieldClientError} on transport or validation failure.
 */
export async function listCollaborationModes(): Promise<CollaborationModeListEnvelope> {
  const raw = await fetchJson("/api/collaboration-modes");
  return parse(CollaborationModeListEnvelopeSchema, raw, "GET /api/collaboration-modes");
}
