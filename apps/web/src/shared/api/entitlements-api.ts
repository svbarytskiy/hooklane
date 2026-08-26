import type { WorkspaceEntitlementResponse } from "@hooklane/contracts";
import { apiClient } from "./api-client";

export async function getWorkspaceEntitlement(workspaceId: string) {
  const { data } = await apiClient.get<WorkspaceEntitlementResponse>(
    `/workspaces/${workspaceId}/entitlement`,
  );
  return data;
}

export async function createWorkspaceSubscriptionCheckout(
  workspaceId: string,
  input: { productCode: string; idempotencyKey: string },
) {
  const { data } = await apiClient.post<{ checkoutUrl: string }>(
    `/workspaces/${workspaceId}/billing/checkout/subscription`,
    { productCode: input.productCode },
    { headers: { "Idempotency-Key": input.idempotencyKey } },
  );
  return data;
}
