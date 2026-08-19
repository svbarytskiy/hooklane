export const executionQueryKeys = {
  all: ["executions"] as const,
  list: (workspaceId: string, workflowId: string) =>
    [...executionQueryKeys.all, workspaceId, workflowId] as const,
  detail: (workspaceId: string, workflowId: string, executionId: string) =>
    [...executionQueryKeys.list(workspaceId, workflowId), executionId] as const,
};
