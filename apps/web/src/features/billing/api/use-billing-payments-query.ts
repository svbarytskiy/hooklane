import { useQuery } from "@tanstack/react-query";
import { getBillingPayments } from "../../../shared/api/billing-api";
import { billingQueryKeys } from "../model/billing-query-keys";

export function useBillingPaymentsQuery(isAuthenticated: boolean) {
  return useQuery({
    queryKey: billingQueryKeys.payments(),
    queryFn: getBillingPayments,
    enabled: isAuthenticated,
  });
}
