/**
 * Read-side API client for agent/model metadata.
 *
 * Covers:
 *   GET /api/agents — list all enabled agent adapters and the default agent ID
 *
 * Agent descriptors are not part of @farfield/protocol (they are server-internal
 * types). We define a local Zod schema that mirrors the shape returned by the
 * server's buildAgentDescriptor() helper.
 */

import { z } from "zod";

import { fetchJson } from "./client";
import { SchemaMismatchError } from "./errors";

// ---------------------------------------------------------------------------
// Local schemas
// ---------------------------------------------------------------------------

/** Capabilities flags exposed per agent by the server. */
const AgentCapabilitiesSchema = z
  .object({
    canSendMessages: z.boolean().optional(),
    canStartThread: z.boolean().optional(),
    canListModels: z.boolean().optional(),
    canSetCollaborationMode: z.boolean().optional(),
    canInterrupt: z.boolean().optional(),
    canReplay: z.boolean().optional(),
    canReadLiveState: z.boolean().optional(),
    canReadStreamEvents: z.boolean().optional(),
  })
  .passthrough();

/** A single agent descriptor as returned by GET /api/agents. */
const AgentDescriptorSchema = z
  .object({
    id: z.string().min(1),
    label: z.string(),
    isConnected: z.boolean(),
    capabilities: AgentCapabilitiesSchema,
    projectDirectories: z.array(z.string()).optional(),
  })
  .passthrough();

const AgentListEnvelopeSchema = z.object({
  ok: z.literal(true),
  agents: z.array(AgentDescriptorSchema),
  defaultAgentId: z.union([z.string(), z.null()]).optional(),
});

// ---------------------------------------------------------------------------
// Inferred types (exported for hook and UI use)
// ---------------------------------------------------------------------------

export type AgentCapabilities = z.infer<typeof AgentCapabilitiesSchema>;
export type AgentDescriptor = z.infer<typeof AgentDescriptorSchema>;
export type AgentListEnvelope = z.infer<typeof AgentListEnvelopeSchema>;

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
 * Fetch the list of enabled agents from GET /api/agents.
 *
 * @returns Validated envelope with `agents` array and optional `defaultAgentId`.
 * @throws {FarfieldClientError} on transport or validation failure.
 */
export async function listAgents(): Promise<AgentListEnvelope> {
  const raw = await fetchJson("/api/agents");
  return parse(AgentListEnvelopeSchema, raw, "GET /api/agents");
}
