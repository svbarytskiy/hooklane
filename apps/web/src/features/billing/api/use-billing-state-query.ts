import { useQuery } from '@tanstack/react-query';
import { getBillingState } from '../../../shared/api/billing-api';
import { billingQueryKeys } from '../model/billing-query-keys';

export function useBillingStateQuery(isAuthenticated: boolean) {
  return useQuery({
    queryKey: billingQueryKeys.state(),
    queryFn: getBillingState,
    enabled: isAuthenticated,
  });
}
