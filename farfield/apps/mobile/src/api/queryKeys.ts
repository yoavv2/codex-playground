/**
 * Centralized query-key factory for @farfield/mobile.
 *
 * All TanStack Query hooks import keys from here to avoid string drift and
 * keep cache invalidation predictable across the app.
 *
 * Pattern: each domain has:
 *   - A root key (for broad invalidation of the whole domain)
 *   - Granular keys for specific queries
 *
 * Usage:
 *   import { queryKeys } from "@/src/api/queryKeys";
 *
 *   // In a query hook:
 *   useQuery({ queryKey: queryKeys.threads.list() })
 *
 *   // Broad invalidation (e.g. after a mutation):
 *   queryClient.invalidateQueries({ queryKey: queryKeys.threads.all })
 */

export const queryKeys = {
  /** Thread list and detail queries. */
  threads: {
    /** Root key — invalidates ALL thread queries. */
    all: ["threads"] as const,
    /** Paginated / full thread list. */
    list: () => [...queryKeys.threads.all, "list"] as const,
    /** Single thread detail by ID. */
    detail: (threadId: string) =>
      [...queryKeys.threads.all, "detail", threadId] as const,
  },

  /** Pending approval queries (per thread). */
  approvals: {
    /** Root key — invalidates ALL approval queries. */
    all: ["approvals"] as const,
    /** Pending approvals for a specific thread. */
    pending: (threadId: string) =>
      [...queryKeys.approvals.all, "pending", threadId] as const,
  },

  /** Agent / model metadata queries. */
  agents: {
    /** Root key — invalidates ALL agent queries. */
    all: ["agents"] as const,
    /** Full list of available agents. */
    list: () => [...queryKeys.agents.all, "list"] as const,
  },

  /** Collaboration mode queries. */
  collaborationModes: {
    /** Root key — invalidates ALL collaboration mode queries. */
    all: ["collaborationModes"] as const,
    /** Full list of collaboration modes supported by the active agent. */
    list: () => [...queryKeys.collaborationModes.all, "list"] as const,
    /** Active collaboration mode for a thread. */
    forThread: (threadId: string) =>
      [...queryKeys.collaborationModes.all, "forThread", threadId] as const,
  },

  /** Live thread state (requests + live-state metadata). */
  liveState: {
    /** Root key — invalidates ALL live-state queries. */
    all: ["liveState"] as const,
    /** Per-thread live state used for request_user_input rendering. */
    forThread: (threadId: string) =>
      [...queryKeys.liveState.all, "forThread", threadId] as const,
  },

  /** Server health/connectivity. */
  health: {
    /** Root key for health-related queries. */
    all: ["health"] as const,
    /** Latest health check result. */
    check: () => [...queryKeys.health.all, "check"] as const,
  },
} as const;
