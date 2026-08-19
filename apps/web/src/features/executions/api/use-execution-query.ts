import { useQuery } from "@tanstack/react-query";
import { getExecution } from "../../../shared/api/executions-api";
import { executionQueryKeys } from "../model/execution-query-keys";

export function useExecutionQuery(
  workspaceId: string,
  workflowId: string,
  executionId: string | null,
  isAuthenticated: boolean,
) {
  return useQuery({
    queryKey: executionId
      ? executionQueryKeys.detail(workspaceId, workflowId, executionId)
      : [...executionQueryKeys.all, "missing-detail"],
    queryFn: () => getExecution(workspaceId, workflowId, executionId as string),
    enabled: Boolean(executionId) && isAuthenticated,
  });
}
