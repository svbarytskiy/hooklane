import { useQuery } from "@tanstack/react-query";
import {
  getAdminInvoices,
  type AdminListParams,
} from "../../../shared/api/admin-billing-api";
import { adminBillingQueryKeys } from "../model/admin-billing-query-keys";

export function useAdminInvoicesQuery(
  params: AdminListParams,
  enabled: boolean,
) {
  return useQuery({
    queryKey: adminBillingQueryKeys.invoices(params),
    queryFn: () => getAdminInvoices(params),
    enabled,
  });
}
