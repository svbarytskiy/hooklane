import { useQuery } from "@tanstack/react-query";
import { getBillingUpcomingInvoice } from "../../../shared/api/billing-api";
import { billingQueryKeys } from "../model/billing-query-keys";

export function useBillingUpcomingInvoiceQuery(isAuthenticated: boolean) {
  return useQuery({
    queryKey: billingQueryKeys.upcomingInvoice(),
    queryFn: getBillingUpcomingInvoice,
    enabled: isAuthenticated,
  });
}
