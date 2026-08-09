import type { WebhookDeliveryHistoryItem } from "@hooklane/contracts";
import {
  ActionIcon,
  Alert,
  Badge,
  Card,
  Code,
  Group,
  Modal,
  ScrollArea,
  Skeleton,
  Stack,
  Text,
  Title,
  Tooltip,
} from "@mantine/core";
import { IconAlertCircle, IconEye, IconRefresh } from "@tabler/icons-react";
import { useState } from "react";
import { getApiErrorMessage } from "../../../shared/api/api-error";
import { useWebhookDeliveriesQuery } from "../api/use-webhook-deliveries-query";

type Props = {
  workspaceId: string;
  workflowId: string;
  isAuthenticated: boolean;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function DeliveryRow({
  delivery,
  onViewPayload,
}: {
  delivery: WebhookDeliveryHistoryItem;
  onViewPayload: (delivery: WebhookDeliveryHistoryItem) => void;
}) {
  return (
    <Card withBorder padding="sm" radius="md">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Stack gap={3} style={{ minWidth: 0 }}>
          <Group gap="xs">
            <Badge
              variant="light"
              color={delivery.executionStatus === "failed" ? "red" : "blue"}
            >
              {delivery.executionStatus}
            </Badge>
            <Text size="xs" c="dimmed">
              {formatDate(delivery.receivedAt)}
            </Text>
          </Group>
          <Text size="sm" fw={600} truncate>
            {delivery.sourceEventId ?? delivery.eventId}
          </Text>
          <Text size="xs" c="dimmed">
            {delivery.payloadSizeBytes.toLocaleString()} bytes · version{" "}
            {delivery.workflowVersionId.slice(0, 8)}
          </Text>
        </Stack>
        <Tooltip label="View payload">
          <ActionIcon
            variant="subtle"
            onClick={() => onViewPayload(delivery)}
            aria-label="View payload"
          >
            <IconEye size={17} />
          </ActionIcon>
        </Tooltip>
      </Group>
    </Card>
  );
}

export function WebhookDeliveryHistoryPanel({
  workspaceId,
  workflowId,
  isAuthenticated,
}: Props) {
  const query = useWebhookDeliveriesQuery(
    workspaceId,
    workflowId,
    isAuthenticated,
  );
  const [selected, setSelected] = useState<WebhookDeliveryHistoryItem | null>(
    null,
  );

  return (
    <Card withBorder radius="lg" padding="lg">
      <Group justify="space-between" mb="md">
        <div>
          <Title order={3}>Delivery history</Title>
          <Text size="sm" c="dimmed">
            Accepted webhook events and their current execution state.
          </Text>
        </div>
        <ActionIcon
          variant="subtle"
          onClick={() => void query.refetch()}
          loading={query.isFetching}
          aria-label="Refresh delivery history"
        >
          <IconRefresh size={17} />
        </ActionIcon>
      </Group>

      {query.isLoading && <Skeleton height={80} />}
      {query.error && (
        <Alert color="red" icon={<IconAlertCircle size={17} />}>
          {getApiErrorMessage(query.error)}
        </Alert>
      )}
      {query.data?.length === 0 && (
        <Text size="sm" c="dimmed">
          No webhook deliveries yet.
        </Text>
      )}
      {query.data && query.data.length > 0 && (
        <ScrollArea.Autosize mah={420}>
          <Stack gap="xs">
            {query.data.map((delivery) => (
              <DeliveryRow
                key={delivery.eventId}
                delivery={delivery}
                onViewPayload={setSelected}
              />
            ))}
          </Stack>
        </ScrollArea.Autosize>
      )}

      <Modal
        opened={Boolean(selected)}
        onClose={() => setSelected(null)}
        title="Webhook payload"
        size="lg"
      >
        <Code block>
          {selected ? JSON.stringify(selected.payload, null, 2) : ""}
        </Code>
      </Modal>
    </Card>
  );
}
