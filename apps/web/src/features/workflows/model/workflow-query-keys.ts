export const workflowQueryKeys = {
  all: ["workflows"] as const,
  list: (workspaceId: string) =>
    [...workflowQueryKeys.all, workspaceId, "list"] as const,
  detail: (workspaceId: string, workflowId: string) =>
    [...workflowQueryKeys.all, workspaceId, "detail", workflowId] as const,
  draft: (workspaceId: string, workflowId: string) =>
    [...workflowQueryKeys.all, workspaceId, "draft", workflowId] as const,
  versions: (workspaceId: string, workflowId: string) =>
    [...workflowQueryKeys.all, workspaceId, "versions", workflowId] as const,
};
