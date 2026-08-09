import { useQuery } from '@tanstack/react-query';
import { getWorkflow } from '../../../shared/api/workflows-api';
import { workflowQueryKeys } from '../model/workflow-query-keys';

export function useWorkflowQuery(
  workspaceId: string | undefined,
  workflowId: string | undefined,
  isAuthenticated: boolean,
) {
  return useQuery({
    queryKey:
      workspaceId && workflowId
        ? workflowQueryKeys.detail(workspaceId, workflowId)
        : [...workflowQueryKeys.all, 'missing-detail'],
    queryFn: () => getWorkflow(workspaceId as string, workflowId as string),
    enabled: Boolean(workspaceId && workflowId) && isAuthenticated,
  });
}
