import { notifications } from "@mantine/notifications";
import { useMutation } from "@tanstack/react-query";
import { getApiErrorMessage } from "../../../shared/api/api-error";
import {
  createCreditsCheckout,
  type CreateCreditsCheckoutInput,
} from "../../../shared/api/billing-api";

export function useCreateCreditsCheckoutMutation() {
  return useMutation({
    mutationFn: (input: CreateCreditsCheckoutInput) =>
      createCreditsCheckout(input),

    onSuccess: ({ checkoutUrl }) => {
      window.location.assign(checkoutUrl);
    },

    onError: (error) => {
      notifications.show({
        color: "red",
        title: "Checkout creation failed",
        message: getApiErrorMessage(error),
      });
    },
  });
}
