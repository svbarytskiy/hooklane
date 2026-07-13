import { useQuery } from '@tanstack/react-query';
import { getCurrentUser } from '../../../shared/api/auth-api';
import { authQueryKeys } from '../model/auth-query-keys';

export function useCurrentUserQuery(accessToken: string | undefined) {
  return useQuery({
    queryKey: authQueryKeys.me(),
    enabled: Boolean(accessToken),
    queryFn: () => {
      if (!accessToken) {
        throw new Error('Missing access token');
      }

      return getCurrentUser(accessToken);
    },
  });
}
