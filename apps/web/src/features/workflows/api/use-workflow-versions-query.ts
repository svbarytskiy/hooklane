import { useQuery } from "@tanstack/react-query";
import { getWorkflowVersions } from "../../../shared/api/workflows-api";
import { workflowQueryKeys } from "../model/workflow-query-keys";

export function useWorkflowVersionsQuery(
  workspaceId: string | undefined,
  workflowId: string | undefined,
  isAuthenticated: boolean,
) {
  return useQuery({
    queryKey:
      workspaceId && workflowId
        ? workflowQueryKeys.versions(workspaceId, workflowId)
        : [...workflowQueryKeys.all, "missing-versions"],
    queryFn: () =>
      getWorkflowVersions(workspaceId as string, workflowId as string),
    enabled: Boolean(workspaceId && workflowId) && isAuthenticated,
  });
}
