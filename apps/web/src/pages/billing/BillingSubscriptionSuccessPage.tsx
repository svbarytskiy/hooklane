import { Alert, Badge, Button, Group, Stack, Text, Title } from "@mantine/core";
import { IconCircleCheck, IconRefresh } from "@tabler/icons-react";
import { Link } from "react-router-dom";
import { useAuthSession } from "../../features/auth/model/use-auth-session";
import { useBillingSubscriptionQuery } from "../../features/billing/api/use-billing-subscription-query";
import { getApiErrorMessage } from "../../shared/api/api-error";

export function BillingSubscriptionSuccessPage() {
  const { accessToken } = useAuthSession();
  const subscriptionQuery = useBillingSubscriptionQuery(Boolean(accessToken));
  const subscription = subscriptionQuery.data?.subscription ?? null;
  const isActive =
    subscription?.status === "active" || subscription?.status === "trialing";

  return (
    <Stack gap="lg" maw={640}>
      <div>
        <Title order={2}>Subscription checkout completed</Title>
        <Text c="dimmed" mt={4}>
          Stripe returned you to the application.
        </Text>
      </div>

      <Alert
        color={isActive ? "green" : "blue"}
        icon={<IconCircleCheck size={20} />}
        title={isActive ? "Subscription active" : "Confirmation in progress"}
      >
        {isActive
          ? "The webhook has confirmed your subscription."
          : "The backend is waiting for Stripe webhook confirmation."}
      </Alert>

      {subscription && (
        <Group className="surface-panel" justify="space-between">
          <Text fw={500}>Current status</Text>
          <Badge color={isActive ? "green" : "yellow"} variant="light">
            {subscription.status}
          </Badge>
        </Group>
      )}

      {subscriptionQuery.isError && (
        <Alert color="red" title="Subscription status could not be loaded">
          {getApiErrorMessage(subscriptionQuery.error)}
        </Alert>
      )}

      <Group>
        <Button component={Link} to="/billing">
          Back to billing
        </Button>
        {!isActive && (
          <Button
            variant="light"
            leftSection={<IconRefresh size={18} />}
            loading={subscriptionQuery.isFetching}
            onClick={() => subscriptionQuery.refetch()}
          >
            Refresh status
          </Button>
        )}
      </Group>
    </Stack>
  );
}
