/**
 * TanStack Query hook for the thread list.
 *
 * Wraps listThreads() from @/src/api/threads with sensible defaults for
 * read-only remote-controller usage:
 *   - Conservative retry count so transient network errors surface quickly
 *   - staleTime / gcTime inherited from the shared QueryClient defaults (30s / 5m)
 *   - Returns derived booleans for loading, empty, and error states so
 *     ThreadsScreen can branch on them without duplicating logic
 *   - Distinguishes initial load from background refetch via `isFirstLoad`
 *   - Exposes `isRefreshing` for pull-to-refresh spinners (non-blocking)
 *   - Returns `sortedThreads` ordered by updatedAt descending
 *
 * Cache key: queryKeys.threads.list() — invalidated after any thread mutation.
 */

import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";

import { listThreads, type ThreadListItem } from "@/src/api/threads";
import { queryKeys } from "@/src/api/queryKeys";
import { FarfieldClientError } from "@/src/api/errors";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Sort thread list by updatedAt descending (most-recently-updated first).
 * Threads without an updatedAt value sort to the end.
 */
function sortByUpdatedAt(threads: ThreadListItem[]): ThreadListItem[] {
  return [...threads].sort((a, b) => {
    const aTime = "updatedAt" in a ? (a.updatedAt as number | undefined) ?? 0 : 0;
    const bTime = "updatedAt" in b ? (b.updatedAt as number | undefined) ?? 0 : 0;
    return bTime - aTime;
  });
}

// ---------------------------------------------------------------------------
// Hook result interface
// ---------------------------------------------------------------------------

export interface UseThreadsResult {
  /**
   * Threads sorted by updatedAt descending, or undefined while the initial
   * fetch is in flight.
   */
  sortedThreads: ThreadListItem[] | undefined;
  /**
   * True only during the very first fetch when no cached data exists yet.
   * Use this to render a full-screen loading indicator. Stays false on
   * subsequent background or manual refetches.
   */
  isFirstLoad: boolean;
  /**
   * True while a manual refetch triggered by pull-to-refresh is in flight.
   * Distinct from `isFirstLoad` so the screen can show a non-blocking
   * RefreshControl spinner instead of replacing the list with a loader.
   */
  isRefreshing: boolean;
  /** True when the query resolved and returned an empty list. */
  isEmpty: boolean;
  /** True when the query has failed. */
  isError: boolean;
  /** The error, if any, cast to FarfieldClientError when applicable. */
  error: Error | null;
  /** Trigger a manual refetch (e.g. pull-to-refresh). */
  refetch: () => void;

  // Legacy compat — same as isFirstLoad; retained so callers that read
  // `isLoading` still compile without changes.
  /** @deprecated Use isFirstLoad for initial-load gating; use isRefreshing for pull-to-refresh. */
  isLoading: boolean;
  /** @deprecated Use sortedThreads. */
  threads: ThreadListItem[] | undefined;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Fetch and cache the thread list from the configured Farfield server.
 *
 * @example
 * const { sortedThreads, isFirstLoad, isRefreshing, isEmpty, isError, error, refetch } = useThreads();
 */
export function useThreads(): UseThreadsResult {
  const query = useQuery({
    queryKey: queryKeys.threads.list(),
    queryFn: listThreads,
    // Retry twice on failure; auth errors / server-unreachable should surface
    // quickly rather than retrying aggressively on a remote-control device.
    retry: 2,
    select: (data) => data.data,
  });

  const refetch = useCallback(() => {
    void query.refetch();
  }, [query.refetch]); // eslint-disable-line react-hooks/exhaustive-deps

  const raw = query.data;
  const sortedThreads = raw ? sortByUpdatedAt(raw) : undefined;

  // isFirstLoad: query is pending AND there's no cached data from a previous
  // successful fetch. After the first success, this stays false even during
  // background refetches triggered by staleTime expiry.
  const isFirstLoad = query.isLoading && !query.data;

  // isRefreshing: a refetch is in flight while we already have data. This is
  // the state pull-to-refresh should reflect.
  const isRefreshing = query.isFetching && !query.isLoading;

  const isEmpty =
    !query.isLoading && !query.isError && (query.data?.length ?? 0) === 0;

  return {
    sortedThreads,
    isFirstLoad,
    isRefreshing,
    isEmpty,
    isError: query.isError,
    error: query.error instanceof FarfieldClientError ? query.error : query.error,
    refetch,
    // Legacy compat
    isLoading: isFirstLoad,
    threads: sortedThreads,
  };
}
