import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateWorkspaceRequest } from '@hooklane/contracts';
import { getApiErrorMessage } from '../../../shared/api/api-error';
import { createWorkspace } from '../../../shared/api/workspaces-api';
import { workspaceQueryKeys } from '../model/workspace-query-keys';

export function useCreateWorkspaceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateWorkspaceRequest) => createWorkspace(input),
    onSuccess: async (workspace) => {
      await queryClient.invalidateQueries({
        queryKey: workspaceQueryKeys.list(),
      });

      notifications.show({
        title: 'Workspace created',
        message: `${workspace.name} is ready to use.`,
        color: 'teal',
      });
    },
    onError: (error) => {
      notifications.show({
        title: 'Could not create workspace',
        message: getApiErrorMessage(error),
        color: 'red',
      });
    },
  });
}
