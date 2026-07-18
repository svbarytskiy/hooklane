import type {
  BillingPaymentsResponse,
  BillingStateResponse,
  BillingSubscriptionResponse,
  CreateBillingPortalResponse,
  CreateCheckoutResponse,
  CreateSubscriptionCheckoutResponse,
  CreditsBalanceResponse,
  StripeCustomerResponse,
} from "@billing-lab/contracts";
import { apiClient } from "./api-client";

export type CreateCheckoutInput = {
  productCode: string;
  idempotencyKey: string;
};

export async function createStripeCustomer(): Promise<StripeCustomerResponse> {
  const response =
    await apiClient.post<StripeCustomerResponse>("/billing/customer");

  return response.data;
}

export async function getBillingState(): Promise<BillingStateResponse> {
  const response = await apiClient.get<BillingStateResponse>("/billing/state");

  return response.data;
}

export async function getBillingPayments(): Promise<BillingPaymentsResponse> {
  const response =
    await apiClient.get<BillingPaymentsResponse>("/billing/payments");

  return response.data;
}

export async function getCreditsBalance(): Promise<CreditsBalanceResponse> {
  const response =
    await apiClient.get<CreditsBalanceResponse>("/billing/credits");

  return response.data;
}

export async function getBillingSubscription(): Promise<BillingSubscriptionResponse> {
  const response = await apiClient.get<BillingSubscriptionResponse>(
    "/billing/subscription",
  );

  return response.data;
}

export async function createCreditsCheckout(
  input: CreateCheckoutInput,
): Promise<CreateCheckoutResponse> {
  const response = await apiClient.post<CreateCheckoutResponse>(
    "/billing/checkout/credits",
    {
      productCode: input.productCode,
    },
    {
      headers: {
        "Idempotency-Key": input.idempotencyKey,
      },
    },
  );

  return response.data;
}

export async function createSubscriptionCheckout(
  input: CreateCheckoutInput,
): Promise<CreateSubscriptionCheckoutResponse> {
  const response = await apiClient.post<CreateSubscriptionCheckoutResponse>(
    "/billing/checkout/subscription",
    {
      productCode: input.productCode,
    },
    {
      headers: {
        "Idempotency-Key": input.idempotencyKey,
      },
    },
  );

  return response.data;
}
export async function createBillingPortalSession(): Promise<CreateBillingPortalResponse> {
  const response =
    await apiClient.post<CreateBillingPortalResponse>("/billing/portal");

  return response.data;
}
