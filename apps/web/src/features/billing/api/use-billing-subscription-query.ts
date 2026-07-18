import { useQuery } from "@tanstack/react-query";
import { getBillingSubscription } from "../../../shared/api/billing-api";
import { billingQueryKeys } from "../model/billing-query-keys";

export function useBillingSubscriptionQuery(isAuthenticated: boolean) {
  return useQuery({
    queryKey: billingQueryKeys.subscription(),
    queryFn: getBillingSubscription,
    enabled: isAuthenticated,
  });
}
