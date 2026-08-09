import type {
  CreateWebhookEndpointRequest,
  CreateWebhookEndpointResponse,
  RotateWebhookEndpointSecretResponse,
  UpdateWebhookEndpointRequest,
  WebhookEndpointSummary,
} from "@hooklane/contracts";
import { apiClient } from "./api-client";

function webhookEndpointsPath(workspaceId: string, workflowId: string) {
  return `/workspaces/${workspaceId}/workflows/${workflowId}/webhook-endpoints`;
}

export async function getWebhookEndpoints(
  workspaceId: string,
  workflowId: string,
) {
  const { data } = await apiClient.get<WebhookEndpointSummary[]>(
    webhookEndpointsPath(workspaceId, workflowId),
  );
  return data;
}

export async function createWebhookEndpoint(
  workspaceId: string,
  workflowId: string,
  input: CreateWebhookEndpointRequest,
) {
  const { data } = await apiClient.post<CreateWebhookEndpointResponse>(
    webhookEndpointsPath(workspaceId, workflowId),
    input,
  );
  return data;
}

export async function updateWebhookEndpoint(
  workspaceId: string,
  workflowId: string,
  endpointId: string,
  input: UpdateWebhookEndpointRequest,
) {
  const { data } = await apiClient.patch<WebhookEndpointSummary>(
    `${webhookEndpointsPath(workspaceId, workflowId)}/${endpointId}`,
    input,
  );
  return data;
}

export async function rotateWebhookEndpointSecret(
  workspaceId: string,
  workflowId: string,
  endpointId: string,
) {
  const { data } = await apiClient.post<RotateWebhookEndpointSecretResponse>(
    `${webhookEndpointsPath(workspaceId, workflowId)}/${endpointId}/rotate-secret`,
  );
  return data;
}
