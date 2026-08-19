import type {
  ExecutionDetail,
  ExecutionStatus,
  ExecutionSummary,
} from "@hooklane/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
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
import { cancelExecution } from "../../../shared/api/executions-api";
import { useExecutionQuery } from "../api/use-execution-query";
import { useExecutionsQuery } from "../api/use-executions-query";
import { executionQueryKeys } from "../model/execution-query-keys";

const statusColor: Record<ExecutionStatus | "skipped", string> = {
  pending: "gray",
  queued: "blue",
  running: "yellow",
  succeeded: "teal",
  failed: "red",
  cancelled: "gray",
  skipped: "gray",
};

function formatDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "medium",
      }).format(new Date(value))
    : "—";
}

function ExecutionRow({
  execution,
  onView,
}: {
  execution: ExecutionSummary;
  onView: () => void;
}) {
  return (
    <Card withBorder padding="sm" radius="md">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Stack gap={3} style={{ minWidth: 0 }}>
          <Group gap="xs">
            <Badge variant="light" color={statusColor[execution.status]}>
              {execution.status}
            </Badge>
            <Text size="xs" c="dimmed">
              {formatDate(execution.createdAt)}
            </Text>
          </Group>
          <Text size="sm" fw={600}>
            Execution {execution.id.slice(0, 8)}
          </Text>
          <Text size="xs" c="dimmed">
            Version {execution.workflowVersionId.slice(0, 8)} · event{" "}
            {execution.incomingEventId.slice(0, 8)}
          </Text>
          {execution.failure && (
            <Text size="xs" c="red">
              {JSON.stringify(execution.failure)}
            </Text>
          )}
        </Stack>
        <Tooltip label="Inspect execution">
          <ActionIcon
            variant="subtle"
            onClick={onView}
            aria-label="Inspect execution"
          >
            <IconEye size={17} />
          </ActionIcon>
        </Tooltip>
      </Group>
    </Card>
  );
}

function ExecutionDetailView({
  detail,
  canCancel,
  isCancelling,
  onCancel,
}: {
  detail: ExecutionDetail;
  canCancel: boolean;
  isCancelling: boolean;
  onCancel: () => void;
}) {
  const isActive = ["pending", "queued", "running"].includes(detail.status);
  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Group gap="xs">
          <Badge color={statusColor[detail.status]}>{detail.status}</Badge>
          <Text size="sm">Started: {formatDate(detail.startedAt)}</Text>
        </Group>
        {canCancel && isActive && (
          <Button
            color="red"
            variant="light"
            size="xs"
            loading={isCancelling}
            onClick={onCancel}
          >
            Cancel execution
          </Button>
        )}
      </Group>
      <div>
        <Text fw={600} size="sm" mb="xs">
          Attempts
        </Text>
        {detail.attempts.length === 0 ? (
          <Text size="sm" c="dimmed">
            Waiting for a worker.
          </Text>
        ) : (
          <Stack gap="xs">
            {detail.attempts.map((attempt) => (
              <Card key={attempt.id} withBorder padding="xs">
                <Group justify="space-between">
                  <Text size="sm">Attempt {attempt.attemptNumber}</Text>
                  <Badge
                    color={
                      attempt.status === "failed"
                        ? "red"
                        : attempt.status === "succeeded"
                          ? "teal"
                          : "yellow"
                    }
                  >
                    {attempt.status}
                  </Badge>
                </Group>
                {attempt.error && (
                  <Code block mt="xs">
                    {JSON.stringify(attempt.error, null, 2)}
                  </Code>
                )}
              </Card>
            ))}
          </Stack>
        )}
      </div>
      <div>
        <Text fw={600} size="sm" mb="xs">
          Step timeline
        </Text>
        {detail.steps.length === 0 ? (
          <Text size="sm" c="dimmed">
            No steps have run yet.
          </Text>
        ) : (
          <Stack gap="xs">
            {detail.steps.map((step) => (
              <Card key={step.id} withBorder padding="sm">
                <Group justify="space-between">
                  <Text size="sm" fw={600}>
                    {step.stepIndex + 1}. {step.stepId}
                  </Text>
                  <Badge color={statusColor[step.status]}>{step.status}</Badge>
                </Group>
                <Text size="xs" c="dimmed" mt={4}>
                  {formatDate(step.startedAt)} → {formatDate(step.completedAt)}
                </Text>
                {step.input !== null && (
                  <>
                    <Text size="xs" fw={600} mt="sm">
                      Input
                    </Text>
                    <Code block>{JSON.stringify(step.input, null, 2)}</Code>
                  </>
                )}
                {step.output !== null && (
                  <>
                    <Text size="xs" fw={600} mt="sm">
                      Output
                    </Text>
                    <Code block>{JSON.stringify(step.output, null, 2)}</Code>
                  </>
                )}
                {step.error !== null && (
                  <>
                    <Text size="xs" fw={600} c="red" mt="sm">
                      Error
                    </Text>
                    <Code block>{JSON.stringify(step.error, null, 2)}</Code>
                  </>
                )}
              </Card>
            ))}
          </Stack>
        )}
      </div>
    </Stack>
  );
}

export function ExecutionHistoryPanel({
  workspaceId,
  workflowId,
  isAuthenticated,
  canCancel,
}: {
  workspaceId: string;
  workflowId: string;
  isAuthenticated: boolean;
  canCancel: boolean;
}) {
  const executions = useExecutionsQuery(
    workspaceId,
    workflowId,
    isAuthenticated,
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useExecutionQuery(
    workspaceId,
    workflowId,
    selectedId,
    isAuthenticated,
  );
  const queryClient = useQueryClient();
  const cancelMutation = useMutation({
    mutationFn: (executionId: string) =>
      cancelExecution(workspaceId, workflowId, executionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: executionQueryKeys.list(workspaceId, workflowId),
      });
      if (selectedId) {
        await queryClient.invalidateQueries({
          queryKey: executionQueryKeys.detail(
            workspaceId,
            workflowId,
            selectedId,
          ),
        });
      }
    },
  });

  return (
    <Card withBorder radius="lg" padding="lg">
      <Group justify="space-between" mb="md">
        <div>
          <Title order={3}>Execution history</Title>
          <Text size="sm" c="dimmed">
            Worker attempts and step-by-step results. Active runs refresh
            automatically.
          </Text>
        </div>
        <ActionIcon
          variant="subtle"
          onClick={() => void executions.refetch()}
          loading={executions.isFetching}
          aria-label="Refresh execution history"
        >
          <IconRefresh size={17} />
        </ActionIcon>
      </Group>
      {executions.isLoading && <Skeleton height={100} />}
      {executions.error && (
        <Alert color="red" icon={<IconAlertCircle size={17} />}>
          {getApiErrorMessage(executions.error)}
        </Alert>
      )}
      {executions.data?.length === 0 && (
        <Text size="sm" c="dimmed">
          No executions yet. Send an event to an active endpoint after
          publishing a workflow.
        </Text>
      )}
      {executions.data && executions.data.length > 0 && (
        <ScrollArea.Autosize mah={420}>
          <Stack gap="xs">
            {executions.data.map((execution) => (
              <ExecutionRow
                key={execution.id}
                execution={execution}
                onView={() => setSelectedId(execution.id)}
              />
            ))}
          </Stack>
        </ScrollArea.Autosize>
      )}
      <Modal
        opened={Boolean(selectedId)}
        onClose={() => setSelectedId(null)}
        title="Execution details"
        size="xl"
      >
        {selected.isLoading && <Skeleton height={180} />}
        {selected.error && (
          <Alert color="red">{getApiErrorMessage(selected.error)}</Alert>
        )}
        {selected.data && (
          <ExecutionDetailView
            detail={selected.data}
            canCancel={canCancel}
            isCancelling={cancelMutation.isPending}
            onCancel={() => cancelMutation.mutate(selected.data.id)}
          />
        )}
      </Modal>
    </Card>
  );
}
