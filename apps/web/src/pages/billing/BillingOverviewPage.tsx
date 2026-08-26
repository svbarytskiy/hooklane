import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Code,
  Group,
  SimpleGrid,
  Select,
  Stack,
  Table,
  Text,
  Title,
  Tooltip,
} from "@mantine/core";
import {
  IconAlertTriangle,
  IconCreditCard,
  IconDownload,
  IconExternalLink,
  IconCrown,
  IconShoppingCart,
} from "@tabler/icons-react";
import { useState } from "react";
import { useAuthSession } from "../../features/auth/model/use-auth-session";
import { useBillingInvoicesQuery } from "../../features/billing/api/use-billing-invoices-query";
import { useBillingPaymentsQuery } from "../../features/billing/api/use-billing-payments-query";
import { useBillingStateQuery } from "../../features/billing/api/use-billing-state-query";
import { useBillingSubscriptionQuery } from "../../features/billing/api/use-billing-subscription-query";
import { useBillingUpcomingInvoiceQuery } from "../../features/billing/api/use-billing-upcoming-invoice-query";
import { useCreateBillingPortalMutation } from "../../features/billing/api/use-create-billing-portal-mutation";
import { useCreateCreditsCheckoutMutation } from "../../features/billing/api/use-create-credits-checkout-mutation";
import { useCreateWorkspaceSubscriptionCheckoutMutation } from "../../features/billing/api/use-create-workspace-subscription-checkout-mutation";
import { useCreditsBalanceQuery } from "../../features/billing/api/use-credits-balance-query";
import { useWorkspaceEntitlementQuery } from "../../features/billing/api/use-workspace-entitlement-query";
import { useWorkspacesQuery } from "../../features/workspaces/api/use-workspaces-query";
import { getApiErrorMessage } from "../../shared/api/api-error";

const PAYMENT_RECOVERY_COPY: Record<
  string,
  { title: string; message: string }
> = {
  incomplete: {
    title: "Payment confirmation required",
    message:
      "Complete the open invoice to activate your subscription. Your bank may require 3D Secure confirmation.",
  },
  past_due: {
    title: "Subscription payment is past due",
    message:
      "A renewal payment failed or needs confirmation. Pay the open invoice or update your payment method.",
  },
  unpaid: {
    title: "Subscription payment is unpaid",
    message:
      "Automatic payment attempts have stopped. Pay the open invoice or update your payment method to restore access.",
  },
  paused: {
    title: "Subscription is paused",
    message:
      "Add a valid payment method in the billing portal before resuming the subscription.",
  },
};

function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getStatusColor(status: string) {
  switch (status) {
    case "paid":
    case "active":
    case "trialing":
      return "green";
    case "failed":
    case "canceled":
    case "expired":
    case "incomplete_expired":
    case "unpaid":
      return "red";
    case "paused":
      return "gray";
    default:
      return "yellow";
  }
}

export function BillingOverviewPage() {
  const { accessToken } = useAuthSession();
  const isAuthenticated = Boolean(accessToken);
  const billingStateQuery = useBillingStateQuery(isAuthenticated);
  const billingPaymentsQuery = useBillingPaymentsQuery(isAuthenticated);
  const creditsBalanceQuery = useCreditsBalanceQuery(isAuthenticated);
  const billingSubscriptionQuery = useBillingSubscriptionQuery(isAuthenticated);
  const billingInvoicesQuery = useBillingInvoicesQuery(isAuthenticated);
  const billingUpcomingInvoiceQuery =
    useBillingUpcomingInvoiceQuery(isAuthenticated);
  const createCreditsCheckoutMutation = useCreateCreditsCheckoutMutation();
  const createBillingPortalMutation = useCreateBillingPortalMutation();
  const workspacesQuery = useWorkspacesQuery(isAuthenticated);
  const [billingWorkspaceId, setBillingWorkspaceId] = useState<string | null>(
    null,
  );
  const workspaces = workspacesQuery.data ?? [];
  const workspaceId = workspaces.some((item) => item.id === billingWorkspaceId)
    ? billingWorkspaceId
    : (workspaces[0]?.id ?? null);
  const workspaceEntitlementQuery = useWorkspaceEntitlementQuery(
    workspaceId,
    isAuthenticated,
  );
  const createWorkspaceCheckoutMutation =
    useCreateWorkspaceSubscriptionCheckoutMutation();

  const hasStripeCustomer = Boolean(billingStateQuery.data?.stripeCustomer);
  const payments = billingPaymentsQuery.data?.payments ?? [];
  const invoiceHistory = billingInvoicesQuery.data?.invoices ?? [];
  const upcomingInvoice = billingUpcomingInvoiceQuery.data?.invoice ?? null;
  const subscription = billingSubscriptionQuery.data?.subscription ?? null;
  const hasCurrentSubscription =
    workspaceEntitlementQuery.data?.source === "stripe_subscription" &&
    workspaceEntitlementQuery.data.status !== "suspended";
  const paymentRecovery = subscription
    ? PAYMENT_RECOVERY_COPY[subscription.status]
    : undefined;
  const openInvoice = invoiceHistory.find(
    (invoice) => invoice.status === "open" && invoice.hostedInvoiceUrl,
  );

  const rows = [
    {
      flow: "Stripe customer",
      status: hasStripeCustomer ? "Ready" : "Created on checkout",
      endpoint: "POST /billing/customer",
    },
    {
      flow: "One-time credits",
      status: "Available",
      endpoint: "POST /billing/checkout/credits",
    },
    {
      flow: "Subscription",
      status: subscription?.status ?? "Available",
      endpoint: "POST /billing/checkout/subscription",
    },
  ];

  const handleBuyCredits = () => {
    createCreditsCheckoutMutation.mutate({
      productCode: "credits_pack_100",
      idempotencyKey: crypto.randomUUID(),
    });
  };

  const handleSubscribe = () => {
    if (!workspaceId) return;
    createWorkspaceCheckoutMutation.mutate({
      workspaceId,
      productCode: "pro_monthly",
      idempotencyKey: crypto.randomUUID(),
    });
  };

  const billingError =
    billingStateQuery.error ??
    billingPaymentsQuery.error ??
    creditsBalanceQuery.error ??
    billingSubscriptionQuery.error;

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start" wrap="wrap">
        <div>
          <Title order={2}>Billing</Title>
          <Text c="dimmed" mt={4}>
            Stripe customer and billing state.
          </Text>
        </div>

        <Group>
          <Button
            leftSection={<IconShoppingCart size={18} />}
            disabled={!isAuthenticated}
            loading={createCreditsCheckoutMutation.isPending}
            onClick={handleBuyCredits}
          >
            Buy 100 credits
          </Button>
          <Button
            variant="light"
            leftSection={<IconCrown size={18} />}
            disabled={
              !isAuthenticated || !workspaceId || hasCurrentSubscription
            }
            loading={createWorkspaceCheckoutMutation.isPending}
            onClick={handleSubscribe}
          >
            {hasCurrentSubscription
              ? "Subscription exists"
              : "Subscribe to Pro"}
          </Button>
          <Button
            variant="default"
            leftSection={<IconCreditCard size={18} />}
            disabled={!isAuthenticated}
            loading={createBillingPortalMutation.isPending}
            onClick={() => createBillingPortalMutation.mutate()}
          >
            Manage billing
          </Button>
        </Group>
      </Group>

      {!isAuthenticated && (
        <Alert color="blue" title="Sign in required">
          Sign in to view your payments, credits, and subscription.
        </Alert>
      )}

      {isAuthenticated && billingError && (
        <Alert color="red" title="Billing data could not be loaded">
          {getApiErrorMessage(billingError)}
        </Alert>
      )}

      {isAuthenticated && (
        <Stack gap="sm" className="surface-panel">
          <Group justify="space-between" align="end" wrap="wrap">
            <Select
              label="Workspace plan"
              placeholder="Select workspace"
              value={workspaceId}
              onChange={(value) =>
                setBillingWorkspaceId(typeof value === "string" ? value : null)
              }
              data={workspaces.map((workspace) => ({
                value: workspace.id,
                label: workspace.name,
              }))}
              w={{ base: "100%", sm: 320 }}
              disabled={workspacesQuery.isLoading || workspaces.length === 0}
            />
            {workspaceEntitlementQuery.data && (
              <Badge
                color={
                  workspaceEntitlementQuery.data.status === "active"
                    ? "green"
                    : "yellow"
                }
                variant="light"
              >
                {workspaceEntitlementQuery.data.plan.name} ·{" "}
                {workspaceEntitlementQuery.data.status}
              </Badge>
            )}
          </Group>
          {workspaceEntitlementQuery.data && (
            <Text size="sm" c="dimmed">
              {workspaceEntitlementQuery.data.plan.limits.maxPublishedWorkflows}{" "}
              workflows ·{" "}
              {workspaceEntitlementQuery.data.plan.limits.maxIntegrations}{" "}
              integrations ·{" "}
              {
                workspaceEntitlementQuery.data.plan.limits
                  .maxExecutionsPerPeriod
              }{" "}
              executions per period
            </Text>
          )}
        </Stack>
      )}

      {isAuthenticated && paymentRecovery && (
        <Alert
          color="orange"
          icon={<IconAlertTriangle size={18} />}
          title={paymentRecovery.title}
        >
          <Stack gap="sm">
            <Text size="sm">{paymentRecovery.message}</Text>
            <Group gap="sm">
              {openInvoice?.hostedInvoiceUrl && (
                <Button
                  component="a"
                  href={openInvoice.hostedInvoiceUrl}
                  size="xs"
                  leftSection={<IconExternalLink size={16} />}
                >
                  Open invoice
                </Button>
              )}
              <Button
                size="xs"
                variant="default"
                leftSection={<IconCreditCard size={16} />}
                loading={createBillingPortalMutation.isPending}
                onClick={() => createBillingPortalMutation.mutate()}
              >
                Manage payment method
              </Button>
            </Group>
          </Stack>
        </Alert>
      )}

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        <Stack gap={4} className="surface-panel">
          <Text size="sm" c="dimmed">
            Credits balance
          </Text>
          <Title order={2}>
            {creditsBalanceQuery.isLoading
              ? "Loading..."
              : (creditsBalanceQuery.data?.balance ?? 0)}
          </Title>
        </Stack>

        <Stack gap={4} className="surface-panel">
          <Text size="sm" c="dimmed">
            Stripe customer
          </Text>
          <Text fw={500}>
            {billingStateQuery.isLoading
              ? "Loading..."
              : hasStripeCustomer
                ? "Connected"
                : "Created on checkout"}
          </Text>
        </Stack>

        <Stack gap={6} className="surface-panel">
          <Text size="sm" c="dimmed">
            Subscription
          </Text>
          {billingSubscriptionQuery.isLoading ? (
            <Text fw={500}>Loading...</Text>
          ) : subscription ? (
            <>
              <Badge
                variant="light"
                color={getStatusColor(subscription.status)}
                w="fit-content"
              >
                {subscription.status}
              </Badge>
              <Text size="sm" c="dimmed">
                Period ends {formatDate(subscription.currentPeriodEnd)}
              </Text>
            </>
          ) : (
            <Text fw={500}>Not subscribed</Text>
          )}
        </Stack>
      </SimpleGrid>

      <Stack gap="md" className="surface-panel">
        <Title order={4}>Next invoice</Title>

        {billingUpcomingInvoiceQuery.isLoading && (
          <Text size="sm" c="dimmed">
            Loading upcoming invoice...
          </Text>
        )}

        {!billingUpcomingInvoiceQuery.isLoading && !upcomingInvoice && (
          <Text size="sm" c="dimmed">
            No upcoming invoice.
          </Text>
        )}

        {upcomingInvoice && (
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <div>
              <Text size="sm" c="dimmed">
                Amount due
              </Text>
              <Text fw={600} size="lg">
                {formatAmount(
                  upcomingInvoice.amountDue,
                  upcomingInvoice.currency,
                )}
              </Text>
            </div>
            <div>
              <Text size="sm" c="dimmed">
                Subtotal
              </Text>
              <Text fw={500}>
                {formatAmount(
                  upcomingInvoice.subtotal,
                  upcomingInvoice.currency,
                )}
              </Text>
            </div>
            <div>
              <Text size="sm" c="dimmed">
                Period ends
              </Text>
              <Text fw={500}>{formatDate(upcomingInvoice.periodEnd)}</Text>
            </div>
          </SimpleGrid>
        )}
      </Stack>

      <Stack gap="sm" className="surface-panel">
        <Title order={4}>Recent payments</Title>

        {billingPaymentsQuery.isLoading && (
          <Text size="sm" c="dimmed">
            Loading payments...
          </Text>
        )}

        {!billingPaymentsQuery.isLoading && payments.length === 0 && (
          <Text size="sm" c="dimmed">
            No payments yet.
          </Text>
        )}

        {payments.length > 0 && (
          <Table.ScrollContainer minWidth={720}>
            <Table verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Product</Table.Th>
                  <Table.Th>Amount</Table.Th>
                  <Table.Th>Credits</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Created</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {payments.map((payment) => (
                  <Table.Tr key={payment.id}>
                    <Table.Td>
                      <Code>{payment.productType}</Code>
                    </Table.Td>
                    <Table.Td>
                      {formatAmount(payment.amount, payment.currency)}
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
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Stack>

      <Stack gap="sm" className="surface-panel">
        <Title order={4}>Invoice history</Title>

        {billingInvoicesQuery.isLoading && (
          <Text size="sm" c="dimmed">
            Loading invoices...
          </Text>
        )}

        {!billingInvoicesQuery.isLoading && invoiceHistory.length === 0 && (
          <Text size="sm" c="dimmed">
            No invoices yet.
          </Text>
        )}

        {invoiceHistory.length > 0 && (
          <Table.ScrollContainer minWidth={860}>
            <Table verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Invoice</Table.Th>
                  <Table.Th>Period</Table.Th>
                  <Table.Th>Due</Table.Th>
                  <Table.Th>Paid</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th ta="right">Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {invoiceHistory.map((invoice) => (
                  <Table.Tr key={invoice.id}>
                    <Table.Td>
                      <Code>
                        {invoice.invoiceNumber ?? invoice.stripeInvoiceId}
                      </Code>
                    </Table.Td>
                    <Table.Td>
                      {formatDate(invoice.periodStart)} -{" "}
                      {formatDate(invoice.periodEnd)}
                    </Table.Td>
                    <Table.Td>
                      {formatAmount(invoice.amountDue, invoice.currency)}
                    </Table.Td>
                    <Table.Td>
                      {formatAmount(invoice.amountPaid, invoice.currency)}
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        variant="light"
                        color={getStatusColor(invoice.status)}
                      >
                        {invoice.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs" justify="flex-end" wrap="nowrap">
                        {invoice.hostedInvoiceUrl && (
                          <Tooltip label="Open hosted invoice">
                            <ActionIcon
                              component="a"
                              href={invoice.hostedInvoiceUrl}
                              target="_blank"
                              rel="noreferrer"
                              variant="subtle"
                              aria-label="Open hosted invoice"
                            >
                              <IconExternalLink size={18} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                        {invoice.invoicePdf && (
                          <Tooltip label="Download invoice PDF">
                            <ActionIcon
                              component="a"
                              href={invoice.invoicePdf}
                              target="_blank"
                              rel="noreferrer"
                              variant="subtle"
                              aria-label="Download invoice PDF"
                            >
                              <IconDownload size={18} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                        {!invoice.hostedInvoiceUrl && !invoice.invoicePdf && (
                          <Text size="sm" c="dimmed">
                            -
                          </Text>
                        )}
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Stack>

      <Table.ScrollContainer minWidth={620} className="surface-panel">
        <Table verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Flow</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>API contract</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((row) => (
              <Table.Tr key={row.flow}>
                <Table.Td>{row.flow}</Table.Td>
                <Table.Td>
                  <Badge variant="light" color={getStatusColor(row.status)}>
                    {row.status}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text ff="monospace" size="sm">
                    {row.endpoint}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Stack>
  );
}
