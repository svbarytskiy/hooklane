import type { AuthMeResponse } from '@billing-lab/contracts';
import { apiClient } from './api-client';

export async function getCurrentUser(): Promise<AuthMeResponse> {
  const response = await apiClient.get<AuthMeResponse>('/auth/me');

  return response.data;
}
