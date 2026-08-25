export const integrationQueryKeys = {
  all: ["integrations"] as const,
  connections: (workspaceId: string) =>
    [...integrationQueryKeys.all, "connections", workspaceId] as const,
};
