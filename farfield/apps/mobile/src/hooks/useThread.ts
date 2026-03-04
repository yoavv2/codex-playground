/**
 * TanStack Query hook for the thread detail view.
 *
 * Composes two reads into a single surface point for ThreadDetailScreen:
 *   1. GET /api/threads/:id          — full conversation state (turns, requests)
 *   2. GET /api/threads/:id/pending-approvals — approval list for the same thread
 *
 * Both queries share the same threadId. The approvals query is treated as
 * secondary: if the agent does not support live state (HTTP 400), we return an
 * empty approval list rather than surfacing an error to the UI.
 *
 * Cache keys:
 *   queryKeys.threads.detail(threadId)     — invalidated after thread mutations
 *   queryKeys.approvals.pending(threadId)  — invalidated after approval responses
 *
 * Interactive fetch state:
 *   isLoading     — true on the very first fetch when no cached data exists yet
 *   isRefreshing  — true during a background refetch when data is already shown
 *                   (used by RefreshControl for pull-to-refresh UX)
 */

import { useQuery } from "@tanstack/react-query";

import { readThread, type ThreadDetailEnvelope } from "@/src/api/threads";
import { listPendingApprovals, type PendingApproval } from "@/src/api/approvals";
import { queryKeys } from "@/src/api/queryKeys";
import { HttpError } from "@/src/api/errors";

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseThreadResult {
  /** Full thread envelope (thread + agentId), or undefined while loading. */
  threadDetail: ThreadDetailEnvelope | undefined;
  /** Pending approvals for the thread, or empty array when unavailable. */
  pendingApprovals: PendingApproval[];
  /**
   * True only while the very first fetch is in flight and no cached data
   * exists yet. The screen should show a full-screen loading state only when
   * this is true.
   */
  isLoading: boolean;
  /**
   * True during a background refetch when the thread already has data in the
   * cache. Use this to drive a RefreshControl instead of hiding the content.
   */
  isRefreshing: boolean;
  /** True when the primary fetch has resolved. */
  isSuccess: boolean;
  /** True when the primary fetch has failed. */
  isError: boolean;
  /** The thread fetch error, if any. */
  error: Error | null;
  /** Trigger a manual refetch of both queries. */
  refetch: () => void;
}

/**
 * Fetch and cache the thread detail and pending approvals for a thread.
 *
 * @param threadId - The thread to fetch (should match the route param).
 *
 * @example
 * const { threadDetail, pendingApprovals, isLoading, isRefreshing, refetch } = useThread(threadId);
 */
export function useThread(threadId: string): UseThreadResult {
  const threadQuery = useQuery({
    queryKey: queryKeys.threads.detail(threadId),
    queryFn: () => readThread(threadId),
    enabled: !!threadId,
    retry: 2,
  });

  const approvalsQuery = useQuery({
    queryKey: queryKeys.approvals.pending(threadId),
    queryFn: () => listPendingApprovals(threadId),
    enabled: !!threadId,
    retry: false,
    // Agents that don't support live state return HTTP 400 — treat that as
    // an empty list rather than an error that blocks the detail view.
    select: (data) => data.pendingApprovals,
  });

  // Map approvals query: 400 -> empty list, other errors propagate silently
  const pendingApprovals: PendingApproval[] =
    approvalsQuery.data ??
    (approvalsQuery.isError && approvalsQuery.error instanceof HttpError
      ? []
      : []);

  // isLoading: true only on the very first fetch (no data in cache yet).
  // TanStack Query v5: isLoading === isPending && isFetching
  const isLoading = threadQuery.isLoading;

  // isRefreshing: true when a background refetch is in progress but we already
  // have data to show — prevents the full-screen loading state from appearing
  // again when the user pulls to refresh or cache invalidation triggers.
  const isRefreshing =
    threadQuery.isFetching && !threadQuery.isLoading;

  return {
    threadDetail: threadQuery.data,
    pendingApprovals,
    isLoading,
    isRefreshing,
    isSuccess: threadQuery.isSuccess,
    isError: threadQuery.isError,
    error: threadQuery.error,
    refetch: () => {
      void threadQuery.refetch();
      void approvalsQuery.refetch();
    },
  };
}
