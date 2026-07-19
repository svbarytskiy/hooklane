import type { QueryClient } from "@tanstack/react-query";
import { billingQueryKeys } from "../../billing/model/billing-query-keys";
import { adminBillingQueryKeys } from "../model/admin-billing-query-keys";

export async function invalidateRefundQueries(
  queryClient: QueryClient,
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: adminBillingQueryKeys.all,
    }),
    queryClient.invalidateQueries({
      queryKey: billingQueryKeys.all,
    }),
  ]);
}
