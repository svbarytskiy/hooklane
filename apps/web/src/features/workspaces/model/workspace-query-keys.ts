export const workspaceQueryKeys = {
  all: ['workspaces'] as const,
  list: () => [...workspaceQueryKeys.all, 'list'] as const,
  members: (workspaceId: string) =>
    [...workspaceQueryKeys.all, 'members', workspaceId] as const,
};
