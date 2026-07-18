import { Alert, Button, Stack, Text, Title } from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";
import { Link } from "react-router-dom";

export function BillingSubscriptionCancelPage() {
  return (
    <Stack gap="lg" maw={640}>
      <div>
        <Title order={2}>Subscription checkout cancelled</Title>
        <Text c="dimmed" mt={4}>
          Stripe returned you without completing the subscription checkout.
        </Text>
      </div>

      <Alert
        color="yellow"
        icon={<IconAlertCircle size={20} />}
        title="Subscription not created"
      >
        No recurring billing agreement was confirmed.
      </Alert>

      <Button component={Link} to="/billing" w="fit-content">
        Back to billing
      </Button>
    </Stack>
  );
}
