import { useQuery } from '@tanstack/react-query';
import { getCurrentUser } from '../../../shared/api/auth-api';
import { authQueryKeys } from '../model/auth-query-keys';

export function useCurrentUserQuery(isAuthenticated: boolean) {
  return useQuery({
    queryKey: authQueryKeys.me(),
    enabled: isAuthenticated,
    queryFn: getCurrentUser,
  });
}
