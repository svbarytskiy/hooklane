import { useQuery } from '@tanstack/react-query';
import { getWorkflowDraft } from '../../../shared/api/workflows-api';
import { workflowQueryKeys } from '../model/workflow-query-keys';

export function useWorkflowDraftQuery(
  workspaceId: string | undefined,
  workflowId: string | undefined,
  isAuthenticated: boolean,
) {
  return useQuery({
    queryKey:
      workspaceId && workflowId
        ? workflowQueryKeys.draft(workspaceId, workflowId)
        : [...workflowQueryKeys.all, 'missing-draft'],
    queryFn: () => getWorkflowDraft(workspaceId as string, workflowId as string),
    enabled: Boolean(workspaceId && workflowId) && isAuthenticated,
  });
}
