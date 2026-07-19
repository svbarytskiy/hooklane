import type {
  AdminInvoicesResponse,
  AdminPaymentsResponse,
  AdminRefundsResponse,
  CreateRefundResponse,
} from "@billing-lab/contracts";
import { apiClient } from "./api-client";

export type AdminListParams = {
  page: number;
  limit: number;
};

export type CreateAdminRefundInput = {
  id: string;
  amount?: number;
  idempotencyKey: string;
};

export async function getAdminPayments(
  params: AdminListParams,
): Promise<AdminPaymentsResponse> {
  const response = await apiClient.get<AdminPaymentsResponse>(
    "/admin/payments",
    { params },
  );

  return response.data;
}

export async function getAdminInvoices(
  params: AdminListParams,
): Promise<AdminInvoicesResponse> {
  const response = await apiClient.get<AdminInvoicesResponse>(
    "/admin/invoices",
    { params },
  );

  return response.data;
}

export async function getAdminRefunds(): Promise<AdminRefundsResponse> {
  const response = await apiClient.get<AdminRefundsResponse>("/admin/refunds");

  return response.data;
}

export async function createAdminPaymentRefund(
  input: CreateAdminRefundInput,
): Promise<CreateRefundResponse> {
  const response = await apiClient.post<CreateRefundResponse>(
    `/admin/payments/${input.id}/refund`,
    { amount: input.amount },
    {
      headers: {
        "Idempotency-Key": input.idempotencyKey,
      },
    },
  );

  return response.data;
}

export async function createAdminInvoiceRefund(
  input: CreateAdminRefundInput,
): Promise<CreateRefundResponse> {
  const response = await apiClient.post<CreateRefundResponse>(
    `/admin/invoices/${input.id}/refund`,
    { amount: input.amount },
    {
      headers: {
        "Idempotency-Key": input.idempotencyKey,
      },
    },
  );

  return response.data;
}
