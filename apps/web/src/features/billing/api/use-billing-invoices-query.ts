import { useQuery } from "@tanstack/react-query";
import { getBillingInvoices } from "../../../shared/api/billing-api";
import { billingQueryKeys } from "../model/billing-query-keys";

export function useBillingInvoicesQuery(isAuthenticated: boolean) {
  return useQuery({
    queryKey: billingQueryKeys.invoices(),
    queryFn: getBillingInvoices,
    enabled: isAuthenticated,
  });
}
