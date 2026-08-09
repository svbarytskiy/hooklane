export const webhookEndpointQueryKeys = {
  all: ["webhook-endpoints"] as const,
  list: (workspaceId: string, workflowId: string) =>
    [...webhookEndpointQueryKeys.all, workspaceId, workflowId] as const,
  history: (workspaceId: string, workflowId: string) =>
    [
      ...webhookEndpointQueryKeys.all,
      "history",
      workspaceId,
      workflowId,
    ] as const,
};
