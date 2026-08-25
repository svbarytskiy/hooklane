import { useQuery } from "@tanstack/react-query";
import { getIntegrationConnections } from "../../../shared/api/integrations-api";
import { integrationQueryKeys } from "../model/integration-query-keys";

export function useIntegrationConnectionsQuery(
  workspaceId: string | undefined,
  isAuthenticated: boolean,
) {
  return useQuery({
    queryKey: workspaceId
      ? integrationQueryKeys.connections(workspaceId)
      : integrationQueryKeys.all,
    queryFn: () => getIntegrationConnections(workspaceId as string),
    enabled: Boolean(workspaceId) && isAuthenticated,
  });
}
