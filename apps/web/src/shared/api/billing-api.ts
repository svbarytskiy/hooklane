import type {
  BillingStateResponse,
  StripeCustomerResponse,
} from '@billing-lab/contracts';
import { apiClient } from './api-client';

export async function createStripeCustomer(): Promise<StripeCustomerResponse> {
  const response = await apiClient.post<StripeCustomerResponse>(
    '/billing/customer',
  );

  return response.data;
}

export async function getBillingState(): Promise<BillingStateResponse> {
  const response = await apiClient.get<BillingStateResponse>('/billing/state');

  return response.data;
}
