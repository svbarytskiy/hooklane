import { notifications } from "@mantine/notifications";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  CreateWebhookEndpointRequest,
  UpdateWebhookEndpointRequest,
} from "@hooklane/contracts";
import { getApiErrorMessage } from "../../../shared/api/api-error";
import {
  createWebhookEndpoint,
  rotateWebhookEndpointSecret,
  updateWebhookEndpoint,
} from "../../../shared/api/webhook-endpoints-api";
import { webhookEndpointQueryKeys } from "../model/webhook-endpoint-query-keys";

function useEndpointCacheInvalidation(workspaceId: string, workflowId: string) {
  const queryClient = useQueryClient();

  return () =>
    queryClient.invalidateQueries({
      queryKey: webhookEndpointQueryKeys.list(workspaceId, workflowId),
    });
}

export function useCreateWebhookEndpointMutation(
  workspaceId: string,
  workflowId: string,
) {
  const invalidate = useEndpointCacheInvalidation(workspaceId, workflowId);

  return useMutation({
    mutationFn: (input: CreateWebhookEndpointRequest) =>
      createWebhookEndpoint(workspaceId, workflowId, input),
    onSuccess: async (result) => {
      await invalidate();
      notifications.show({
        color: "teal",
        title: "Webhook endpoint created",
        message: result.signingSecret
          ? "Copy the signing secret before closing the dialog."
          : "This endpoint accepts unsigned requests.",
      });
    },
    onError: (error) => {
      notifications.show({
        color: "red",
        title: "Could not create webhook endpoint",
        message: getApiErrorMessage(error),
      });
    },
  });
}

export function useUpdateWebhookEndpointMutation(
  workspaceId: string,
  workflowId: string,
) {
  const invalidate = useEndpointCacheInvalidation(workspaceId, workflowId);

  return useMutation({
    mutationFn: ({
      endpointId,
      input,
    }: {
      endpointId: string;
      input: UpdateWebhookEndpointRequest;
    }) => updateWebhookEndpoint(workspaceId, workflowId, endpointId, input),
    onSuccess: async (endpoint) => {
      await invalidate();
      notifications.show({
        color: endpoint.status === "active" ? "teal" : "gray",
        title:
          endpoint.status === "active"
            ? "Endpoint activated"
            : "Endpoint paused",
        message:
          endpoint.status === "active"
            ? "New signed deliveries can be accepted."
            : "New deliveries will be rejected until you reactivate it.",
      });
    },
    onError: (error) => {
      notifications.show({
        color: "red",
        title: "Could not update endpoint",
        message: getApiErrorMessage(error),
      });
    },
  });
}

export function useRotateWebhookEndpointSecretMutation(
  workspaceId: string,
  workflowId: string,
) {
  const invalidate = useEndpointCacheInvalidation(workspaceId, workflowId);

  return useMutation({
    mutationFn: (endpointId: string) =>
      rotateWebhookEndpointSecret(workspaceId, workflowId, endpointId),
    onSuccess: async () => {
      await invalidate();
    },
    onError: (error) => {
      notifications.show({
        color: "red",
        title: "Could not rotate signing secret",
        message: getApiErrorMessage(error),
      });
    },
  });
}
