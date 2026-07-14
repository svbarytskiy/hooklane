import { Badge, Button, Group, Stack, Table, Text, Title } from "@mantine/core";
import { IconShoppingCart } from "@tabler/icons-react";
import { useAuthSession } from "../../features/auth/model/use-auth-session";
import { useBillingStateQuery } from "../../features/billing/api/use-billing-state-query";
import { useCreateCreditsCheckoutMutation } from "../../features/billing/api/use-create-credits-checkout-mutation";

export function BillingOverviewPage() {
  const { accessToken } = useAuthSession();
  const isAuthenticated = Boolean(accessToken);
  const billingStateQuery = useBillingStateQuery(isAuthenticated);
  const createCreditsCheckoutMutation = useCreateCreditsCheckoutMutation();

  const hasStripeCustomer = Boolean(billingStateQuery.data?.stripeCustomer);

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

        <Group>
          <Button
            leftSection={<IconShoppingCart size={18} />}
            disabled={!isAuthenticated}
            loading={createCreditsCheckoutMutation.isPending}
            onClick={handleBuyCredits}
          >
            Buy 100 credits
          </Button>
        </Group>
      </Group>

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
