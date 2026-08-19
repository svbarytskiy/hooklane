import { useQuery } from "@tanstack/react-query";
import { getExecutions } from "../../../shared/api/executions-api";
import { executionQueryKeys } from "../model/execution-query-keys";

export function useExecutionsQuery(
  workspaceId: string | undefined,
  workflowId: string | undefined,
  isAuthenticated: boolean,
) {
  return useQuery({
    queryKey:
      workspaceId && workflowId
        ? executionQueryKeys.list(workspaceId, workflowId)
        : [...executionQueryKeys.all, "missing-list"],
    queryFn: () => getExecutions(workspaceId as string, workflowId as string),
    enabled: Boolean(workspaceId && workflowId) && isAuthenticated,
    refetchInterval: (query) =>
      query.state.data?.some((execution) =>
        ["pending", "queued", "running"].includes(execution.status),
      )
        ? 3_000
        : false,
  });
}
