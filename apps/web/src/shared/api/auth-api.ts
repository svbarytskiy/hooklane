import type { AuthMeResponse } from '@hooklane/contracts';
import { apiClient } from './api-client';

export async function getCurrentUser(): Promise<AuthMeResponse> {
  const response = await apiClient.get<AuthMeResponse>('/auth/me');

  return response.data;
}
