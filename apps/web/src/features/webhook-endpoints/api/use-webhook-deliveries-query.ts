import { useQuery } from "@tanstack/react-query";
import { getWebhookDeliveries } from "../../../shared/api/webhook-deliveries-api";
import { webhookEndpointQueryKeys } from "../model/webhook-endpoint-query-keys";

export function useWebhookDeliveriesQuery(
  workspaceId: string | undefined,
  workflowId: string | undefined,
  isAuthenticated: boolean,
) {
  return useQuery({
    queryKey:
      workspaceId && workflowId
        ? webhookEndpointQueryKeys.history(workspaceId, workflowId)
        : [...webhookEndpointQueryKeys.all, "missing-history"],
    queryFn: () =>
      getWebhookDeliveries(workspaceId as string, workflowId as string),
    enabled: Boolean(workspaceId && workflowId) && isAuthenticated,
  });
}
