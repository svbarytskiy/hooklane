import type { ProfileResponse } from '@billing-lab/contracts';
import { apiClient } from './api-client';

export async function getMyProfile(): Promise<ProfileResponse> {
  const response = await apiClient.get<ProfileResponse>('/profiles/me');

  return response.data;
}
