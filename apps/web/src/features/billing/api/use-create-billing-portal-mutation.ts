import { notifications } from "@mantine/notifications";
import { useMutation } from "@tanstack/react-query";
import { getApiErrorMessage } from "../../../shared/api/api-error";
import { createBillingPortalSession } from "../../../shared/api/billing-api";

export function useCreateBillingPortalMutation() {
  return useMutation({
    mutationFn: createBillingPortalSession,

    onSuccess: ({ portalUrl }) => {
      window.location.assign(portalUrl);
    },

    onError: (error) => {
      notifications.show({
        color: "red",
        title: "Billing portal could not be opened",
        message: getApiErrorMessage(error),
      });
    },
  });
}
