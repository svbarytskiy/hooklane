import { useQuery } from "@tanstack/react-query";
import { getAdminRefunds } from "../../../shared/api/admin-billing-api";
import { adminBillingQueryKeys } from "../model/admin-billing-query-keys";

export function useAdminRefundsQuery(enabled: boolean) {
  return useQuery({
    queryKey: adminBillingQueryKeys.refunds(),
    queryFn: getAdminRefunds,
    enabled,
  });
}
