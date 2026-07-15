import {
  Alert,
  Badge,
  Button,
  Code,
  Group,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { IconShoppingCart } from "@tabler/icons-react";
import { useAuthSession } from "../../features/auth/model/use-auth-session";
import { useBillingPaymentsQuery } from "../../features/billing/api/use-billing-payments-query";
import { useBillingStateQuery } from "../../features/billing/api/use-billing-state-query";
import { useCreateCreditsCheckoutMutation } from "../../features/billing/api/use-create-credits-checkout-mutation";
import { useCreditsBalanceQuery } from "../../features/billing/api/use-credits-balance-query";
import { getApiErrorMessage } from "../../shared/api/api-error";

function formatPaymentAmount(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

function formatPaymentDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getStatusColor(status: string) {
  switch (status) {
    case "paid":
      return "green";
    case "failed":
    case "canceled":
    case "expired":
      return "red";
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
  const createCreditsCheckoutMutation = useCreateCreditsCheckoutMutation();

  const hasStripeCustomer = Boolean(billingStateQuery.data?.stripeCustomer);
  const payments = billingPaymentsQuery.data?.payments ?? [];

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
      status: "Queued",
      endpoint: "POST /billing/checkout/subscription",
    },
  ];

  const handleBuyCredits = () => {
    createCreditsCheckoutMutation.mutate({
      productCode: "credits_pack_100",
      idempotencyKey: crypto.randomUUID(),
    });
  };

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={2}>Billing</Title>
          <Text c="dimmed" mt={4}>
            Stripe customer and billing state.
          </Text>
        </div>

        <Button
          leftSection={<IconShoppingCart size={18} />}
          disabled={!isAuthenticated}
          loading={createCreditsCheckoutMutation.isPending}
          onClick={handleBuyCredits}
        >
          Buy 100 credits
        </Button>
      </Group>

      {!isAuthenticated && (
        <Alert color="blue" title="Sign in required">
          Sign in to view your payments and credits balance.
        </Alert>
      )}

      {isAuthenticated &&
        (billingPaymentsQuery.isError || creditsBalanceQuery.isError) && (
          <Alert color="red" title="Billing data could not be loaded">
            {getApiErrorMessage(
              billingPaymentsQuery.error ?? creditsBalanceQuery.error,
            )}
          </Alert>
        )}

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
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
      </SimpleGrid>

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
                      {formatPaymentAmount(payment.amount, payment.currency)}
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
                    <Table.Td>{formatPaymentDate(payment.createdAt)}</Table.Td>
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
                  <Badge
                    variant="light"
                    color={
                      row.status === "Ready" || row.status === "Available"
                        ? "green"
                        : "gray"
                    }
                  >
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
