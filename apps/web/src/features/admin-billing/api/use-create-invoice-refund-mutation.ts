import { notifications } from "@mantine/notifications";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createAdminInvoiceRefund,
  type CreateAdminRefundInput,
} from "../../../shared/api/admin-billing-api";
import { getApiErrorMessage } from "../../../shared/api/api-error";
import { invalidateRefundQueries } from "./invalidate-refund-queries";

export function useCreateInvoiceRefundMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateAdminRefundInput) =>
      createAdminInvoiceRefund(input),

    onSuccess: async ({ amount, currency }) => {
      await invalidateRefundQueries(queryClient);
      notifications.show({
        title: "Refund created",
        message: `${amount / 100} ${currency.toUpperCase()} invoice refund was created.`,
      });
    },

    onError: (error) => {
      notifications.show({
        color: "red",
        title: "Invoice refund failed",
        message: getApiErrorMessage(error),
      });
    },
  });
}
