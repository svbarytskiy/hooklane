import { notifications } from "@mantine/notifications";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createAdminPaymentRefund,
  type CreateAdminRefundInput,
} from "../../../shared/api/admin-billing-api";
import { getApiErrorMessage } from "../../../shared/api/api-error";
import { invalidateRefundQueries } from "./invalidate-refund-queries";

export function useCreatePaymentRefundMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateAdminRefundInput) =>
      createAdminPaymentRefund(input),

    onSuccess: async ({ amount, currency }) => {
      await invalidateRefundQueries(queryClient);
      notifications.show({
        title: "Refund created",
        message: `${amount / 100} ${currency.toUpperCase()} payment refund was created.`,
      });
    },

    onError: (error) => {
      notifications.show({
        color: "red",
        title: "Payment refund failed",
        message: getApiErrorMessage(error),
      });
    },
  });
}
