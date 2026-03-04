/**
 * TanStack Query hook for the thread list.
 *
 * Wraps listThreads() from @/src/api/threads with sensible defaults for
 * read-only remote-controller usage:
 *   - Conservative retry count so transient network errors surface quickly
 *   - staleTime / gcTime inherited from the shared QueryClient defaults (30s / 5m)
 *   - Returns derived booleans for loading, empty, and error states so
 *     ThreadsScreen can branch on them without duplicating logic
 *
 * Cache key: queryKeys.threads.list() — invalidated after any thread mutation.
 */

import { useQuery } from "@tanstack/react-query";

import { listThreads, type ThreadListItem } from "@/src/api/threads";
import { queryKeys } from "@/src/api/queryKeys";
import { FarfieldClientError } from "@/src/api/errors";

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseThreadsResult {
  /** Ordered thread items from GET /api/threads, or undefined while loading. */
  threads: ThreadListItem[] | undefined;
  /** True while the initial fetch is in flight. */
  isLoading: boolean;
  /** True when the query resolved and returned an empty list. */
  isEmpty: boolean;
  /** True when the query has failed. */
  isError: boolean;
  /** The error, if any, cast to FarfieldClientError when applicable. */
  error: Error | null;
  /** Trigger a manual refetch (e.g. pull-to-refresh). */
  refetch: () => void;
}

/**
 * Fetch and cache the thread list from the configured Farfield server.
 *
 * @example
 * const { threads, isLoading, isEmpty, isError, error, refetch } = useThreads();
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

  return {
    threads: query.data,
    isLoading: query.isLoading,
    isEmpty: !query.isLoading && !query.isError && (query.data?.length ?? 0) === 0,
    isError: query.isError,
    error: query.error instanceof FarfieldClientError ? query.error : query.error,
    refetch: () => {
      void query.refetch();
    },
  };
}
