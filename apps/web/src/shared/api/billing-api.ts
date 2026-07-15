import type {
  BillingPaymentsResponse,
  BillingStateResponse,
  CreateCheckoutResponse,
  CreditsBalanceResponse,
  StripeCustomerResponse,
} from "@billing-lab/contracts";
import { apiClient } from "./api-client";

export type CreateCreditsCheckoutInput = {
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

export async function createCreditsCheckout(
  input: CreateCreditsCheckoutInput,
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
