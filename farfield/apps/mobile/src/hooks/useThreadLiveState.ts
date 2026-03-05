/**
 * TanStack Query hook for GET /api/threads/:id/live-state.
 *
 * Exposes a UI-friendly pending request_user_input list derived from the
 * thread conversation state.
 */

import { useQuery } from "@tanstack/react-query";

import {
  listPendingUserInputRequests,
  readThreadLiveState,
  type PendingUserInputRequest,
  type ThreadLiveStateEnvelope,
} from "@/src/api/live-state";
import { HttpError } from "@/src/api/errors";
import { queryKeys } from "@/src/api/queryKeys";

export interface UseThreadLiveStateResult {
  liveState: ThreadLiveStateEnvelope | undefined;
  pendingUserInputRequests: PendingUserInputRequest[];
  supportsLiveState: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
  isSuccess: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Fetch and cache a thread's live-state payload.
 *
 * If the connected agent does not support live-state reads (HTTP 400),
 * this hook reports `supportsLiveState: false` and returns an empty request list.
 */
export function useThreadLiveState(threadId: string): UseThreadLiveStateResult {
  const query = useQuery({
    queryKey: queryKeys.liveState.forThread(threadId),
    queryFn: () => readThreadLiveState(threadId),
    enabled: !!threadId,
    retry: false,
  });

  const unsupported =
    query.isError &&
    query.error instanceof HttpError &&
    query.error.statusCode === 400;

  const liveState = unsupported ? undefined : query.data;
  const pendingUserInputRequests = listPendingUserInputRequests(
    liveState?.conversationState ?? null
  );

  return {
    liveState,
    pendingUserInputRequests,
    supportsLiveState: !unsupported,
    isLoading: query.isLoading,
    isRefreshing: query.isFetching && !query.isLoading,
    isSuccess: query.isSuccess || unsupported,
    isError: query.isError && !unsupported,
    error: unsupported ? null : query.error,
    refetch: () => {
      void query.refetch();
    },
  };
}
