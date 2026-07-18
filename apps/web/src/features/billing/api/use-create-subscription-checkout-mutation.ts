import { notifications } from "@mantine/notifications";
import { useMutation } from "@tanstack/react-query";
import { getApiErrorMessage } from "../../../shared/api/api-error";
import {
  createSubscriptionCheckout,
  type CreateCheckoutInput,
} from "../../../shared/api/billing-api";

export function useCreateSubscriptionCheckoutMutation() {
  return useMutation({
    mutationFn: (input: CreateCheckoutInput) =>
      createSubscriptionCheckout(input),

    onSuccess: ({ checkoutUrl }) => {
      window.location.assign(checkoutUrl);
    },

    onError: (error) => {
      notifications.show({
        color: "red",
        title: "Subscription checkout failed",
        message: getApiErrorMessage(error),
      });
    },
  });
}
