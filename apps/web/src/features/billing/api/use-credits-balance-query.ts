import { useQuery } from "@tanstack/react-query";
import { getCreditsBalance } from "../../../shared/api/billing-api";
import { billingQueryKeys } from "../model/billing-query-keys";

export function useCreditsBalanceQuery(isAuthenticated: boolean) {
  return useQuery({
    queryKey: billingQueryKeys.credits(),
    queryFn: getCreditsBalance,
    enabled: isAuthenticated,
  });
}
