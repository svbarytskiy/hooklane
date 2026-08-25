import { notifications } from "@mantine/notifications";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiErrorMessage } from "../../../shared/api/api-error";
import {
  beginSlackAuthorization,
  disconnectIntegrationConnection,
} from "../../../shared/api/integrations-api";
import { integrationQueryKeys } from "../model/integration-query-keys";

export function useBeginSlackAuthorizationMutation(workspaceId: string) {
  return useMutation({
    mutationFn: () => beginSlackAuthorization(workspaceId),
    onSuccess: ({ authorizationUrl }) => {
      window.location.assign(authorizationUrl);
    },
    onError: (error) => {
      notifications.show({
        color: "red",
        title: "Could not start Slack connection",
        message: getApiErrorMessage(error),
      });
    },
  });
}

export function useDisconnectIntegrationMutation(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (connectionId: string) =>
      disconnectIntegrationConnection(workspaceId, connectionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: integrationQueryKeys.connections(workspaceId),
      });
      notifications.show({
        color: "teal",
        title: "Slack disconnected",
        message: "The connection can no longer be used by workflow executions.",
      });
    },
    onError: (error) => {
      notifications.show({
        color: "red",
        title: "Could not disconnect Slack",
        message: getApiErrorMessage(error),
      });
    },
  });
}
