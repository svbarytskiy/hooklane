import { useQuery } from '@tanstack/react-query';
import { getWorkflows } from '../../../shared/api/workflows-api';
import { workflowQueryKeys } from '../model/workflow-query-keys';

export function useWorkflowsQuery(
  workspaceId: string | undefined,
  isAuthenticated: boolean,
) {
  return useQuery({
    queryKey: workspaceId
      ? workflowQueryKeys.list(workspaceId)
      : [...workflowQueryKeys.all, 'missing-workspace'],
    queryFn: () => getWorkflows(workspaceId as string),
    enabled: Boolean(workspaceId) && isAuthenticated,
  });
}
