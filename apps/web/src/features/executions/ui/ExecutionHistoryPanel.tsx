import type {
  ExecutionDetail,
  ExecutionStatus,
  ExecutionSummary,
} from "@hooklane/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  Textarea,
  Title,
  Tooltip,
} from "@mantine/core";
import { IconAlertCircle, IconEye, IconRefresh } from "@tabler/icons-react";
import { useState } from "react";
import { getApiErrorMessage } from "../../../shared/api/api-error";
import {
  cancelExecution,
  deadLetterExecution,
  getExecutionObservability,
  replayExecution,
  resumeExecution,
  retryFailedStep,
} from "../../../shared/api/executions-api";
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
  dead_lettered: "dark",
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

function formatDuration(value: number | null) {
  if (value === null) return "—";
  if (value < 1_000) return `${value} ms`;
  return `${(value / 1_000).toFixed(1)} s`;
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
  isRecovering,
  onRetry,
  onResume,
  onReplay,
  onDeadLetter,
}: {
  detail: ExecutionDetail;
  canCancel: boolean;
  isCancelling: boolean;
  onCancel: () => void;
  isRecovering: boolean;
  onRetry: () => void;
  onResume: (stepId: string) => void;
  onReplay: () => void;
  onDeadLetter: () => void;
}) {
  const isActive = ["pending", "queued", "running"].includes(detail.status);
  const latestFailedStep = detail.steps.find(
    (step) => step.status === "failed",
  );
  const isAmbiguous =
    latestFailedStep?.error !== null &&
    typeof latestFailedStep?.error === "object" &&
    (latestFailedStep.error as { code?: unknown }).code ===
      "http_ambiguous_result";
  const isTerminal = [
    "succeeded",
    "failed",
    "cancelled",
    "dead_lettered",
  ].includes(detail.status);
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
      {canCancel && detail.status === "failed" && (
        <Group gap="xs">
          {isAmbiguous && latestFailedStep ? (
            <Button
              size="xs"
              loading={isRecovering}
              onClick={() => onResume(latestFailedStep.stepId)}
            >
              Resolve and resume
            </Button>
          ) : (
            <Button size="xs" loading={isRecovering} onClick={onRetry}>
              Retry failed step
            </Button>
          )}
          <Button
            size="xs"
            color="red"
            variant="light"
            loading={isRecovering}
            onClick={onDeadLetter}
          >
            Move to dead letter
          </Button>
        </Group>
      )}
      {canCancel && isTerminal && (
        <Button
          size="xs"
          variant="light"
          loading={isRecovering}
          onClick={onReplay}
          w="fit-content"
        >
          Replay as new execution
        </Button>
      )}
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
      {detail.recoveries.length > 0 && (
        <div>
          <Text fw={600} size="sm" mb="xs">
            Recovery audit
          </Text>
          <Stack gap="xs">
            {detail.recoveries.map((recovery) => (
              <Card key={recovery.id} withBorder padding="xs">
                <Group justify="space-between">
                  <Text size="sm">{recovery.operation}</Text>
                  <Text size="xs" c="dimmed">
                    {formatDate(recovery.createdAt)}
                  </Text>
                </Group>
                {recovery.stepId && (
                  <Text size="xs" c="dimmed">
                    Step {recovery.stepId}
                  </Text>
                )}
              </Card>
            ))}
          </Stack>
        </div>
      )}
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
  const observability = useQuery({
    queryKey: ["execution-observability", workspaceId, workflowId],
    queryFn: () => getExecutionObservability(workspaceId, workflowId),
    enabled: isAuthenticated,
    refetchInterval: 10_000,
  });
  const [resumeStepId, setResumeStepId] = useState<string | null>(null);
  const [resumeOutput, setResumeOutput] = useState("{}");
  const [resumeError, setResumeError] = useState<string | null>(null);
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
  const recoveryMutation = useMutation({
    mutationFn: async (input: {
      operation: "retry" | "resume" | "replay" | "dead-letter";
      executionId: string;
      stepId?: string;
      output?: unknown;
    }) => {
      if (input.operation === "retry") {
        return retryFailedStep(workspaceId, workflowId, input.executionId);
      }
      if (input.operation === "resume") {
        return resumeExecution(workspaceId, workflowId, input.executionId, {
          stepId: input.stepId!,
          output: input.output,
        });
      }
      if (input.operation === "replay") {
        return replayExecution(workspaceId, workflowId, input.executionId);
      }
      return deadLetterExecution(workspaceId, workflowId, input.executionId);
    },
    onSuccess: async (response) => {
      setResumeStepId(null);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: executionQueryKeys.list(workspaceId, workflowId),
        }),
        queryClient.invalidateQueries({
          queryKey: ["execution-observability", workspaceId, workflowId],
        }),
        selectedId
          ? queryClient.invalidateQueries({
              queryKey: executionQueryKeys.detail(
                workspaceId,
                workflowId,
                selectedId,
              ),
            })
          : Promise.resolve(),
      ]);
      if ("sourceExecutionId" in response) setSelectedId(response.executionId);
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
      {observability.data && (
        <SimpleGrid cols={{ base: 2, sm: 4 }} mb="md">
          <Card withBorder padding="sm">
            <Text size="xs" c="dimmed">
              Executions
            </Text>
            <Text fw={700}>{observability.data.executions.total}</Text>
          </Card>
          <Card withBorder padding="sm">
            <Text size="xs" c="dimmed">
              Retried
            </Text>
            <Text fw={700}>{observability.data.executions.retried}</Text>
          </Card>
          <Card withBorder padding="sm">
            <Text size="xs" c="dimmed">
              Ambiguous
            </Text>
            <Text fw={700}>{observability.data.executions.ambiguous}</Text>
          </Card>
          <Card withBorder padding="sm">
            <Text size="xs" c="dimmed">
              Average duration
            </Text>
            <Text fw={700}>
              {formatDuration(
                observability.data.executions.averageDurationMs,
              )}
            </Text>
          </Card>
          <Card withBorder padding="sm">
            <Text size="xs" c="dimmed">
              Global queue active / waiting
            </Text>
            <Text fw={700}>
              {observability.data.queue.active} /{" "}
              {observability.data.queue.waiting}
            </Text>
          </Card>
          <Card withBorder padding="sm">
            <Text size="xs" c="dimmed">
              Queue delayed
            </Text>
            <Text fw={700}>{observability.data.queue.delayed}</Text>
          </Card>
          <Card withBorder padding="sm">
            <Text size="xs" c="dimmed">
              Retained failed jobs
            </Text>
            <Text fw={700}>{observability.data.queue.failed}</Text>
          </Card>
          <Card withBorder padding="sm">
            <Text size="xs" c="dimmed">
              Oldest waiting job
            </Text>
            <Text fw={700}>
              {formatDuration(observability.data.queue.oldestWaitingAgeMs)}
            </Text>
          </Card>
        </SimpleGrid>
      )}
      {observability.error && (
        <Alert color="yellow" mb="md">
          Metrics unavailable: {getApiErrorMessage(observability.error)}
        </Alert>
      )}
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
        {recoveryMutation.error && (
          <Alert color="red" mb="sm">
            {getApiErrorMessage(recoveryMutation.error)}
          </Alert>
        )}
        {selected.data && (
          <ExecutionDetailView
            detail={selected.data}
            canCancel={canCancel}
            isCancelling={cancelMutation.isPending}
            onCancel={() => cancelMutation.mutate(selected.data.id)}
            isRecovering={recoveryMutation.isPending}
            onRetry={() =>
              recoveryMutation.mutate({
                operation: "retry",
                executionId: selected.data.id,
              })
            }
            onResume={(stepId) => {
              setResumeStepId(stepId);
              setResumeOutput("{}");
              setResumeError(null);
            }}
            onReplay={() =>
              recoveryMutation.mutate({
                operation: "replay",
                executionId: selected.data.id,
              })
            }
            onDeadLetter={() =>
              recoveryMutation.mutate({
                operation: "dead-letter",
                executionId: selected.data.id,
              })
            }
          />
        )}
      </Modal>
      <Modal
        opened={Boolean(resumeStepId)}
        onClose={() => setResumeStepId(null)}
        title="Resolve ambiguous step"
      >
        <Stack>
          <Text size="sm">
            Confirm the operation in the provider first, then paste the output
            that downstream steps should receive.
          </Text>
          <Textarea
            label="Reconciled JSON output"
            minRows={6}
            value={resumeOutput}
            onChange={(event) => setResumeOutput(event.currentTarget.value)}
            error={resumeError}
          />
          <Button
            loading={recoveryMutation.isPending}
            onClick={() => {
              try {
                const output: unknown = JSON.parse(resumeOutput);
                recoveryMutation.mutate({
                  operation: "resume",
                  executionId: selectedId!,
                  stepId: resumeStepId!,
                  output,
                });
              } catch {
                setResumeError("Output must be valid JSON");
              }
            }}
          >
            Resume after reconciled step
          </Button>
        </Stack>
      </Modal>
    </Card>
  );
}
