import { useQuery } from "@tanstack/react-query";
import { getWebhookEndpoints } from "../../../shared/api/webhook-endpoints-api";
import { webhookEndpointQueryKeys } from "../model/webhook-endpoint-query-keys";

export function useWebhookEndpointsQuery(
  workspaceId: string | undefined,
  workflowId: string | undefined,
  isAuthenticated: boolean,
) {
  return useQuery({
    queryKey:
      workspaceId && workflowId
        ? webhookEndpointQueryKeys.list(workspaceId, workflowId)
        : [...webhookEndpointQueryKeys.all, "missing"],
    queryFn: () =>
      getWebhookEndpoints(workspaceId as string, workflowId as string),
    enabled: Boolean(workspaceId && workflowId) && isAuthenticated,
  });
}
