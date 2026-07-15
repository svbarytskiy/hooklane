import { Alert, Button, Code, Group, Stack, Text, Title } from "@mantine/core";
import { IconAlertCircle, IconCircleCheck } from "@tabler/icons-react";
import { Link, useSearchParams } from "react-router-dom";

type BillingCheckoutResultPageProps = {
  cancelled?: boolean;
};

export function BillingCheckoutResultPage({
  cancelled = false,
}: BillingCheckoutResultPageProps) {
  const [searchParams] = useSearchParams();
  const paymentId = searchParams.get("payment_id");

  return (
    <Stack gap="lg" maw={640}>
      <div>
        <Title order={2}>
          {cancelled ? "Checkout cancelled" : "Checkout started"}
        </Title>
        <Text c="dimmed" mt={4}>
          {cancelled
            ? "No payment was completed. You can return to billing and try again."
            : "Stripe returned you to the application after checkout."}
        </Text>
      </div>

      <Alert
        color={cancelled ? "yellow" : "blue"}
        icon={
          cancelled ? (
            <IconAlertCircle size={20} />
          ) : (
            <IconCircleCheck size={20} />
          )
        }
        title={
          cancelled ? "Payment not completed" : "Payment is not confirmed yet"
        }
      >
        {cancelled
          ? "The payment remains unconfirmed. Credits are not added."
          : "This redirect does not confirm the payment. The backend will confirm it through a Stripe webhook."}
      </Alert>

      {paymentId && (
        <Stack gap={4} className="surface-panel">
          <Text size="sm" c="dimmed">
            Local payment ID
          </Text>
          <Code>{paymentId}</Code>
        </Stack>
      )}

      <Group>
        <Button component={Link} to="/billing">
          Back to billing
        </Button>
        {cancelled && (
          <Button component={Link} to="/billing" variant="light">
            Try again
          </Button>
        )}
      </Group>
    </Stack>
  );
}
