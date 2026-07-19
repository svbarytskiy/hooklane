import { useQuery } from "@tanstack/react-query";
import {
  getAdminPayments,
  type AdminListParams,
} from "../../../shared/api/admin-billing-api";
import { adminBillingQueryKeys } from "../model/admin-billing-query-keys";

export function useAdminPaymentsQuery(
  params: AdminListParams,
  enabled: boolean,
) {
  return useQuery({
    queryKey: adminBillingQueryKeys.payments(params),
    queryFn: () => getAdminPayments(params),
    enabled,
  });
}
