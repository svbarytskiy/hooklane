import type { IntegrationConnectionSummary } from "@hooklane/contracts";
import { apiClient } from "./api-client";

function integrationsPath(workspaceId: string) {
  return `/workspaces/${workspaceId}/integrations`;
}

export async function getIntegrationConnections(
  workspaceId: string,
): Promise<IntegrationConnectionSummary[]> {
  const { data } = await apiClient.get<IntegrationConnectionSummary[]>(
    integrationsPath(workspaceId),
  );
  return data;
}

export async function beginSlackAuthorization(workspaceId: string): Promise<{
  authorizationUrl: string;
}> {
  const { data } = await apiClient.post<{ authorizationUrl: string }>(
    `${integrationsPath(workspaceId)}/slack/authorize`,
  );
  return data;
}

export async function disconnectIntegrationConnection(
  workspaceId: string,
  connectionId: string,
): Promise<void> {
  await apiClient.delete(`${integrationsPath(workspaceId)}/${connectionId}`);
}
