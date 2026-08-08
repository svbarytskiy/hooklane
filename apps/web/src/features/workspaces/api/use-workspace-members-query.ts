import { useQuery } from '@tanstack/react-query';
import { getWorkspaceMembers } from '../../../shared/api/workspaces-api';
import { workspaceQueryKeys } from '../model/workspace-query-keys';

export function useWorkspaceMembersQuery(
  workspaceId: string | null,
  isAuthenticated: boolean,
) {
  return useQuery({
    queryKey: workspaceId
      ? workspaceQueryKeys.members(workspaceId)
      : [...workspaceQueryKeys.all, 'members', 'none'],
    queryFn: () => getWorkspaceMembers(workspaceId as string),
    enabled: Boolean(workspaceId) && isAuthenticated,
  });
}
