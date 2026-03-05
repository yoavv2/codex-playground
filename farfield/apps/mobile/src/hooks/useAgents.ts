/**
 * TanStack Query hook for GET /api/agents.
 */

import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";

import { listAgents, type AgentDescriptor } from "@/src/api/agents";
import { queryKeys } from "@/src/api/queryKeys";
import { FarfieldClientError } from "@/src/api/errors";

export interface UseAgentsResult {
  agents: AgentDescriptor[] | undefined;
  enabledAgents: AgentDescriptor[] | undefined;
  defaultAgentId: string | null | undefined;
  isLoading: boolean;
  isRefreshing: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useAgents(): UseAgentsResult {
  const query = useQuery({
    queryKey: queryKeys.agents.list(),
    queryFn: listAgents,
    retry: 2,
  });

  const refetch = useCallback(() => {
    void query.refetch();
  }, [query.refetch]); // eslint-disable-line react-hooks/exhaustive-deps

  const agents = query.data?.agents;
  const enabledAgents = agents?.filter((agent) => agent.enabled);

  return {
    agents,
    enabledAgents,
    defaultAgentId: query.data?.defaultAgentId,
    isLoading: query.isLoading,
    isRefreshing: query.isFetching && !query.isLoading,
    isError: query.isError,
    error: query.error instanceof FarfieldClientError ? query.error : query.error,
    refetch,
  };
}
