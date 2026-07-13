import { useQuery } from '@tanstack/react-query';
import { getMyProfile } from '../../../shared/api/profiles-api';
import { profileQueryKeys } from '../model/profile-query-keys';

export function useMyProfileQuery(accessToken: string | undefined) {
  return useQuery({
    queryKey: profileQueryKeys.me(),
    enabled: Boolean(accessToken),
    queryFn: () => {
      if (!accessToken) {
        throw new Error('Missing access token');
      }

      return getMyProfile(accessToken);
    },
  });
}
