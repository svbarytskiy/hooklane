import type { WebhookDeliveryHistoryItem } from "@hooklane/contracts";
import { apiClient } from "./api-client";

export async function getWebhookDeliveries(
  workspaceId: string,
  workflowId: string,
  limit = 50,
) {
  const { data } = await apiClient.get<WebhookDeliveryHistoryItem[]>(
    `/workspaces/${workspaceId}/workflows/${workflowId}/webhook-deliveries`,
    { params: { limit } },
  );
  return data;
}
