import type { ProfileResponse } from '@billing-lab/contracts';
import { apiClient } from './api-client';

export async function getMyProfile(accessToken: string): Promise<ProfileResponse> {
  const response = await apiClient.get<ProfileResponse>('/profiles/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return response.data;
}
