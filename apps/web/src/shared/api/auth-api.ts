import type { AuthMeResponse } from '@billing-lab/contracts';
import { apiClient } from './api-client';

export async function getCurrentUser(accessToken: string): Promise<AuthMeResponse> {
  const response = await apiClient.get<AuthMeResponse>('/auth/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return response.data;
}
