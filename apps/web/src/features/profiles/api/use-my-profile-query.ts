import { useQuery } from '@tanstack/react-query';
import { getMyProfile } from '../../../shared/api/profiles-api';
import { profileQueryKeys } from '../model/profile-query-keys';

export function useMyProfileQuery(isAuthenticated: boolean) {
  return useQuery({
    queryKey: profileQueryKeys.me(),
    enabled: isAuthenticated,
    queryFn: getMyProfile,
  });
}
