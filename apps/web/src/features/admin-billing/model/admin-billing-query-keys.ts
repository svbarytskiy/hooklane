import type { AdminListParams } from "../../../shared/api/admin-billing-api";

export const adminBillingQueryKeys = {
  all: ["admin-billing"] as const,
  payments: (params: AdminListParams) =>
    [...adminBillingQueryKeys.all, "payments", params] as const,
  invoices: (params: AdminListParams) =>
    [...adminBillingQueryKeys.all, "invoices", params] as const,
  refunds: () => [...adminBillingQueryKeys.all, "refunds"] as const,
};
