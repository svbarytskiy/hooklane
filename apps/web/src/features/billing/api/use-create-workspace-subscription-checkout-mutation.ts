import { notifications } from "@mantine/notifications";
import { useMutation } from "@tanstack/react-query";
import { getApiErrorMessage } from "../../../shared/api/api-error";
import { createWorkspaceSubscriptionCheckout } from "../../../shared/api/entitlements-api";

export function useCreateWorkspaceSubscriptionCheckoutMutation() {
  return useMutation({
    mutationFn: (input: {
      workspaceId: string;
      productCode: string;
      idempotencyKey: string;
    }) => createWorkspaceSubscriptionCheckout(input.workspaceId, input),
    onSuccess: ({ checkoutUrl }) => window.location.assign(checkoutUrl),
    onError: (error) =>
      notifications.show({
        color: "red",
        title: "Workspace checkout failed",
        message: getApiErrorMessage(error),
      }),
  });
}
