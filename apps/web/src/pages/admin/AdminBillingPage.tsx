import type {
  AdminInvoice,
  AdminPayment,
  AdminRefund,
} from "@hooklane/contracts";
import {
  Alert,
  Badge,
  Button,
  Code,
  Group,
  Loader,
  Pagination,
  Stack,
  Table,
  Tabs,
  Text,
  Title,
} from "@mantine/core";
import {
  IconCashBanknote,
  IconFileInvoice,
  IconReceiptRefund,
  IconShieldLock,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { useAdminInvoicesQuery } from "../../features/admin-billing/api/use-admin-invoices-query";
import { useAdminPaymentsQuery } from "../../features/admin-billing/api/use-admin-payments-query";
import { useAdminRefundsQuery } from "../../features/admin-billing/api/use-admin-refunds-query";
import { useCreateInvoiceRefundMutation } from "../../features/admin-billing/api/use-create-invoice-refund-mutation";
import { useCreatePaymentRefundMutation } from "../../features/admin-billing/api/use-create-payment-refund-mutation";
import {
  RefundModal,
  type RefundTarget,
} from "../../features/admin-billing/ui/RefundModal";
import { useAuthSession } from "../../features/auth/model/use-auth-session";
import { useMyProfileQuery } from "../../features/profiles/api/use-my-profile-query";
import { getApiErrorMessage } from "../../shared/api/api-error";

const PAGE_SIZE = 25;
const COMMITTED_REFUND_STATUSES = new Set([
  "pending",
  "requires_action",
  "succeeded",
]);

function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getStatusColor(status: string): string {
  switch (status) {
    case "paid":
    case "succeeded":
      return "green";
    case "failed":
    case "canceled":
    case "uncollectible":
    case "void":
      return "red";
    case "pending":
    case "requires_action":
    case "open":
      return "yellow";
    default:
      return "gray";
  }
}

function buildRefundTotals(
  refunds: AdminRefund[],
  source: "paymentId" | "invoiceId",
): Map<string, number> {
  const totals = new Map<string, number>();

  for (const refund of refunds) {
    const sourceId = refund[source];

    if (!sourceId || !COMMITTED_REFUND_STATUSES.has(refund.status)) {
      continue;
    }

    totals.set(sourceId, (totals.get(sourceId) ?? 0) + refund.amount);
  }

  return totals;
}

export function AdminBillingPage() {
  const { accessToken } = useAuthSession();
  const profileQuery = useMyProfileQuery(Boolean(accessToken));
  const isAdmin = profileQuery.data?.role === "admin";
  const [paymentPage, setPaymentPage] = useState(1);
  const [invoicePage, setInvoicePage] = useState(1);
  const [refundTarget, setRefundTarget] = useState<RefundTarget | null>(null);

  const paymentsQuery = useAdminPaymentsQuery(
    { page: paymentPage, limit: PAGE_SIZE },
    isAdmin,
  );
  const invoicesQuery = useAdminInvoicesQuery(
    { page: invoicePage, limit: PAGE_SIZE },
    isAdmin,
  );
  const refundsQuery = useAdminRefundsQuery(isAdmin);
  const paymentRefundMutation = useCreatePaymentRefundMutation();
  const invoiceRefundMutation = useCreateInvoiceRefundMutation();

  const refunds = useMemo(
    () => refundsQuery.data?.refunds ?? [],
    [refundsQuery.data?.refunds],
  );
  const paymentRefundTotals = useMemo(
    () => buildRefundTotals(refunds, "paymentId"),
    [refunds],
  );
  const invoiceRefundTotals = useMemo(
    () => buildRefundTotals(refunds, "invoiceId"),
    [refunds],
  );

  const activeMutation =
    refundTarget?.kind === "invoice"
      ? invoiceRefundMutation
      : paymentRefundMutation;

  const openPaymentRefund = (payment: AdminPayment) => {
    const refundedAmount = paymentRefundTotals.get(payment.id) ?? 0;

    setRefundTarget({
      kind: "payment",
      id: payment.id,
      idempotencyKey: crypto.randomUUID(),
      label: payment.productType,
      currency: payment.currency,
      refundableAmount: Math.max(0, payment.amount - refundedAmount),
    });
  };

  const openInvoiceRefund = (invoice: AdminInvoice) => {
    const refundedAmount = invoiceRefundTotals.get(invoice.id) ?? 0;

    setRefundTarget({
      kind: "invoice",
      id: invoice.id,
      idempotencyKey: crypto.randomUUID(),
      label: invoice.invoiceNumber ?? invoice.stripeInvoiceId,
      currency: invoice.currency,
      refundableAmount: Math.max(0, invoice.amountPaid - refundedAmount),
    });
  };

  const confirmRefund = (amount: number | undefined) => {
    if (!refundTarget) return;

    const input = {
      id: refundTarget.id,
      amount,
      idempotencyKey: refundTarget.idempotencyKey,
    };
    const options = {
      onSuccess: () => setRefundTarget(null),
    };

    if (refundTarget.kind === "payment") {
      paymentRefundMutation.mutate(input, options);
      return;
    }

    invoiceRefundMutation.mutate(input, options);
  };

  if (!accessToken) {
    return (
      <Alert color="blue" title="Sign in required">
        Sign in with an administrator account to open billing administration.
      </Alert>
    );
  }

  if (profileQuery.isLoading) {
    return (
      <Group justify="center" py="xl">
        <Loader size="sm" />
        <Text>Checking administrator access...</Text>
      </Group>
    );
  }

  if (profileQuery.isError) {
    return (
      <Alert color="red" title="Profile could not be loaded">
        {getApiErrorMessage(profileQuery.error)}
      </Alert>
    );
  }

  if (!isAdmin) {
    return (
      <Alert
        color="red"
        icon={<IconShieldLock size={18} />}
        title="Administrator access required"
      >
        This account cannot access billing administration.
      </Alert>
    );
  }

  const queryError =
    paymentsQuery.error ?? invoicesQuery.error ?? refundsQuery.error;

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>Billing administration</Title>
        <Text c="dimmed" mt={4}>
          Payments, subscription invoices, and Stripe refunds.
        </Text>
      </div>

      {queryError && (
        <Alert color="red" title="Admin billing data could not be loaded">
          {getApiErrorMessage(queryError)}
        </Alert>
      )}

      <Tabs defaultValue="payments">
        <Tabs.List>
          <Tabs.Tab
            value="payments"
            leftSection={<IconCashBanknote size={16} />}
          >
            Payments
          </Tabs.Tab>
          <Tabs.Tab
            value="invoices"
            leftSection={<IconFileInvoice size={16} />}
          >
            Invoices
          </Tabs.Tab>
          <Tabs.Tab
            value="refunds"
            leftSection={<IconReceiptRefund size={16} />}
          >
            Refunds
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="payments" pt="md">
          <Stack gap="md" className="surface-panel">
            <Group justify="space-between">
              <div>
                <Title order={4}>Credit payments</Title>
                <Text size="sm" c="dimmed">
                  {paymentsQuery.data?.pagination.total ?? 0} total payments
                </Text>
              </div>
            </Group>

            {paymentsQuery.isLoading ? (
              <Loader size="sm" />
            ) : (
              <Table.ScrollContainer minWidth={980}>
                <Table verticalSpacing="sm">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Product</Table.Th>
                      <Table.Th>User</Table.Th>
                      <Table.Th>Amount</Table.Th>
                      <Table.Th>Credits</Table.Th>
                      <Table.Th>Status</Table.Th>
                      <Table.Th>Created</Table.Th>
                      <Table.Th ta="right">Action</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {(paymentsQuery.data?.payments ?? []).map((payment) => {
                      const refundedAmount =
                        paymentRefundTotals.get(payment.id) ?? 0;
                      const refundableAmount = Math.max(
                        0,
                        payment.amount - refundedAmount,
                      );
                      const canRefund =
                        payment.status === "paid" &&
                        Boolean(payment.stripePaymentIntentId) &&
                        refundableAmount > 0 &&
                        !refundsQuery.isLoading;

                      return (
                        <Table.Tr key={payment.id}>
                          <Table.Td>
                            <Code>{payment.productType}</Code>
                          </Table.Td>
                          <Table.Td>
                            <Text size="xs" ff="monospace">
                              {payment.userId}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Stack gap={0}>
                              <Text>
                                {formatAmount(payment.amount, payment.currency)}
                              </Text>
                              {refundedAmount > 0 && (
                                <Text size="xs" c="dimmed">
                                  {formatAmount(
                                    refundableAmount,
                                    payment.currency,
                                  )}{" "}
                                  available
                                </Text>
                              )}
                            </Stack>
                          </Table.Td>
                          <Table.Td>{payment.creditsAmount}</Table.Td>
                          <Table.Td>
                            <Badge
                              variant="light"
                              color={getStatusColor(payment.status)}
                            >
                              {payment.status}
                            </Badge>
                          </Table.Td>
                          <Table.Td>{formatDate(payment.createdAt)}</Table.Td>
                          <Table.Td ta="right">
                            <Button
                              size="xs"
                              variant="light"
                              color="red"
                              leftSection={<IconReceiptRefund size={15} />}
                              disabled={!canRefund}
                              onClick={() => openPaymentRefund(payment)}
                            >
                              {refundableAmount > 0 ? "Refund" : "Refunded"}
                            </Button>
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            )}

            {(paymentsQuery.data?.pagination.totalPages ?? 0) > 1 && (
              <Pagination
                value={paymentPage}
                onChange={setPaymentPage}
                total={paymentsQuery.data?.pagination.totalPages ?? 1}
              />
            )}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="invoices" pt="md">
          <Stack gap="md" className="surface-panel">
            <div>
              <Title order={4}>Subscription invoices</Title>
              <Text size="sm" c="dimmed">
                {invoicesQuery.data?.pagination.total ?? 0} total invoices
              </Text>
            </div>

            {invoicesQuery.isLoading ? (
              <Loader size="sm" />
            ) : (
              <Table.ScrollContainer minWidth={1040}>
                <Table verticalSpacing="sm">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Invoice</Table.Th>
                      <Table.Th>User</Table.Th>
                      <Table.Th>Paid</Table.Th>
                      <Table.Th>Period</Table.Th>
                      <Table.Th>Status</Table.Th>
                      <Table.Th ta="right">Action</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {(invoicesQuery.data?.invoices ?? []).map((invoice) => {
                      const refundedAmount =
                        invoiceRefundTotals.get(invoice.id) ?? 0;
                      const refundableAmount = Math.max(
                        0,
                        invoice.amountPaid - refundedAmount,
                      );
                      const canRefund =
                        invoice.status === "paid" &&
                        refundableAmount > 0 &&
                        !refundsQuery.isLoading;

                      return (
                        <Table.Tr key={invoice.id}>
                          <Table.Td>
                            <Code>
                              {invoice.invoiceNumber ?? invoice.stripeInvoiceId}
                            </Code>
                          </Table.Td>
                          <Table.Td>
                            <Text size="xs" ff="monospace">
                              {invoice.userId}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Stack gap={0}>
                              <Text>
                                {formatAmount(
                                  invoice.amountPaid,
                                  invoice.currency,
                                )}
                              </Text>
                              {refundedAmount > 0 && (
                                <Text size="xs" c="dimmed">
                                  {formatAmount(
                                    refundableAmount,
                                    invoice.currency,
                                  )}{" "}
                                  available
                                </Text>
                              )}
                            </Stack>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm">
                              {formatDate(invoice.periodStart)}
                            </Text>
                            <Text size="xs" c="dimmed">
                              to {formatDate(invoice.periodEnd)}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Badge
                              variant="light"
                              color={getStatusColor(invoice.status)}
                            >
                              {invoice.status}
                            </Badge>
                          </Table.Td>
                          <Table.Td ta="right">
                            <Button
                              size="xs"
                              variant="light"
                              color="red"
                              leftSection={<IconReceiptRefund size={15} />}
                              disabled={!canRefund}
                              onClick={() => openInvoiceRefund(invoice)}
                            >
                              {refundableAmount > 0 ? "Refund" : "Refunded"}
                            </Button>
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            )}

            {(invoicesQuery.data?.pagination.totalPages ?? 0) > 1 && (
              <Pagination
                value={invoicePage}
                onChange={setInvoicePage}
                total={invoicesQuery.data?.pagination.totalPages ?? 1}
              />
            )}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="refunds" pt="md">
          <Stack gap="md" className="surface-panel">
            <div>
              <Title order={4}>Refund history</Title>
              <Text size="sm" c="dimmed">
                {refunds.length} synchronized Stripe refunds
              </Text>
            </div>

            {refundsQuery.isLoading ? (
              <Loader size="sm" />
            ) : (
              <Table.ScrollContainer minWidth={960}>
                <Table verticalSpacing="sm">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Stripe refund</Table.Th>
                      <Table.Th>Source</Table.Th>
                      <Table.Th>User</Table.Th>
                      <Table.Th>Amount</Table.Th>
                      <Table.Th>Status</Table.Th>
                      <Table.Th>Created</Table.Th>
                      <Table.Th>Failure</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {refunds.map((refund) => (
                      <Table.Tr key={refund.id}>
                        <Table.Td>
                          <Code>{refund.stripeRefundId}</Code>
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs" ff="monospace">
                            {refund.paymentId
                              ? `payment:${refund.paymentId}`
                              : `invoice:${refund.invoiceId}`}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs" ff="monospace">
                            {refund.userId}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          {formatAmount(refund.amount, refund.currency)}
                        </Table.Td>
                        <Table.Td>
                          <Badge
                            variant="light"
                            color={getStatusColor(refund.status)}
                          >
                            {refund.status}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          {formatDate(refund.stripeCreatedAt)}
                        </Table.Td>
                        <Table.Td>
                          <Text
                            size="sm"
                            c={refund.failureReason ? "red" : "dimmed"}
                          >
                            {refund.failureReason ?? "None"}
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            )}
          </Stack>
        </Tabs.Panel>
      </Tabs>

      <RefundModal
        key={refundTarget?.id ?? "closed"}
        opened={Boolean(refundTarget)}
        target={refundTarget}
        loading={activeMutation.isPending}
        onClose={() => {
          if (!activeMutation.isPending) {
            setRefundTarget(null);
          }
        }}
        onConfirm={confirmRefund}
      />
    </Stack>
  );
}
