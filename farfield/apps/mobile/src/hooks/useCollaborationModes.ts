/**
 * TanStack Query hook for available collaboration mode presets.
 */

import { useQuery } from "@tanstack/react-query";

import {
  listCollaborationModes,
  type CollaborationModeListEnvelope,
  type CollaborationModeListItem,
} from "@/src/api/collaboration";
import { queryKeys } from "@/src/api/queryKeys";

export interface UseCollaborationModesResult {
  collaborationModes: CollaborationModeListItem[];
  envelope: CollaborationModeListEnvelope | undefined;
  isLoading: boolean;
  isRefreshing: boolean;
  isSuccess: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Read and cache collaboration mode presets from GET /api/collaboration-modes.
 */
export function useCollaborationModes(): UseCollaborationModesResult {
  const query = useQuery({
    queryKey: queryKeys.collaborationModes.list(),
    queryFn: () => listCollaborationModes(),
    retry: false,
  });

  return {
    collaborationModes: query.data?.data ?? [],
    envelope: query.data,
    isLoading: query.isLoading,
    isRefreshing: query.isFetching && !query.isLoading,
    isSuccess: query.isSuccess,
    isError: query.isError,
    error: query.error,
    refetch: () => {
      void query.refetch();
    },
  };
}
