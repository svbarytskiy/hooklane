import { useQuery } from '@tanstack/react-query';
import { getWorkspaces } from '../../../shared/api/workspaces-api';
import { workspaceQueryKeys } from '../model/workspace-query-keys';

export function useWorkspacesQuery(isAuthenticated: boolean) {
  return useQuery({
    queryKey: workspaceQueryKeys.list(),
    queryFn: getWorkspaces,
    enabled: isAuthenticated,
  });
}
