import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Divider,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
  ThemeIcon,
  Title,
  Tooltip,
} from "@mantine/core";
import type {
  ConditionStep,
  DelayStep,
  HttpRequestStep,
  IntegrationConnectionSummary,
  SlackSendMessageStep,
  TransformStep,
  WorkflowDefinition,
  WorkflowStep,
  WorkflowStepType,
  WorkflowValidationError,
} from "@hooklane/contracts";
import {
  IconAlertCircle,
  IconArrowDown,
  IconArrowUp,
  IconBraces,
  IconPlus,
  IconSend,
  IconTrash,
} from "@tabler/icons-react";
import { useState } from "react";

type WorkflowDraftEditorProps = {
  initialDefinition: WorkflowDefinition;
  integrationConnections: IntegrationConnectionSummary[];
  validationErrors: WorkflowValidationError[];
  canEdit: boolean;
  isArchived: boolean;
  isSaving: boolean;
  isValidating: boolean;
  isPublishing: boolean;
  isArchiving: boolean;
  onSave: (definition: WorkflowDefinition) => void;
  onValidate: () => void;
  onPublish: () => void;
  onArchive: () => void;
};

function createStep(type: WorkflowStepType): WorkflowStep {
  const id = crypto.randomUUID();

  if (type === "http_request") {
    return {
      id,
      type,
      name: "HTTP request",
      config: { url: "https://api.example.com", method: "POST" },
    } satisfies HttpRequestStep;
  }

  if (type === "transform") {
    return {
      id,
      type,
      name: "Transform data",
      config: { assignments: { output: "$.input" } },
    } satisfies TransformStep;
  }

  if (type === "delay") {
    return {
      id,
      type,
      name: "Delay",
      config: { durationMs: 1_000 },
    } satisfies DelayStep;
  }

  if (type === "slack_send_message") {
    return {
      id,
      type,
      name: "Send Slack message",
      config: { connectionId: "", channel: "", text: "" },
    } satisfies SlackSendMessageStep;
  }

  return {
    id,
    type,
    name: "Condition",
    config: { expression: '$.status === "approved"' },
  } satisfies ConditionStep;
}

function replaceStepType(
  step: WorkflowStep,
  type: WorkflowStepType,
): WorkflowStep {
  const replacement = createStep(type);
  return { ...replacement, id: step.id, name: step.name };
}

function StepConfigFields({
  step,
  disabled,
  integrationConnections,
  onChange,
}: {
  step: WorkflowStep;
  disabled: boolean;
  integrationConnections: IntegrationConnectionSummary[];
  onChange: (step: WorkflowStep) => void;
}) {
  if (step.type === "http_request") {
    return (
      <Stack gap="sm">
        <Group grow align="flex-start">
          <TextInput
            label="URL"
            value={step.config.url}
            disabled={disabled}
            onChange={(event) =>
              onChange({
                ...step,
                config: { ...step.config, url: event.currentTarget.value },
              })
            }
          />
          <Select
            label="Method"
            value={step.config.method}
            disabled={disabled}
            data={["GET", "POST", "PUT", "PATCH", "DELETE"]}
            onChange={(method) =>
              method &&
              onChange({
                ...step,
                config: {
                  ...step.config,
                  method: method as HttpRequestStep["config"]["method"],
                },
              })
            }
          />
        </Group>
        <Checkbox
          label="Provider supports idempotency"
          description="Hooklane sends one stable key for this execution and step across every retry. The destination API must honor the selected header."
          checked={Boolean(step.config.idempotency)}
          disabled={disabled}
          onChange={(event) =>
            onChange({
              ...step,
              config: {
                ...step.config,
                idempotency: event.currentTarget.checked
                  ? { mode: "execution_step" }
                  : undefined,
              },
            })
          }
        />
        {step.config.idempotency && (
          <TextInput
            label="Idempotency header"
            description="Defaults to Idempotency-Key. Change this only when the provider expects another header."
            placeholder="Idempotency-Key"
            value={step.config.idempotency.headerName ?? ""}
            disabled={disabled}
            onChange={(event) =>
              onChange({
                ...step,
                config: {
                  ...step.config,
                  idempotency: {
                    mode: "execution_step",
                    headerName: event.currentTarget.value || undefined,
                  },
                },
              })
            }
          />
        )}
      </Stack>
    );
  }

  if (step.type === "transform") {
    const assignments = Object.entries(step.config.assignments);
    const updateAssignments = (nextAssignments: [string, string][]) => {
      onChange({
        ...step,
        config: { assignments: Object.fromEntries(nextAssignments) },
      });
    };

    return (
      <Stack gap="xs">
        {assignments.map(([field, expression], index) => (
          <Group key={`${field}-${index}`} align="flex-end" wrap="nowrap">
            <TextInput
              label={index === 0 ? "Output field" : undefined}
              value={field}
              disabled={disabled}
              style={{ flex: 1 }}
              onChange={(event) => {
                const nextAssignments = [...assignments];
                nextAssignments[index] = [
                  event.currentTarget.value,
                  expression,
                ];
                updateAssignments(nextAssignments);
              }}
            />
            <TextInput
              label={index === 0 ? "Expression" : undefined}
              value={expression}
              disabled={disabled}
              style={{ flex: 2 }}
              onChange={(event) => {
                const nextAssignments = [...assignments];
                nextAssignments[index] = [field, event.currentTarget.value];
                updateAssignments(nextAssignments);
              }}
            />
            {!disabled && (
              <Tooltip label="Remove assignment">
                <ActionIcon
                  variant="subtle"
                  color="red"
                  onClick={() =>
                    updateAssignments(
                      assignments.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Tooltip>
            )}
          </Group>
        ))}
        {!disabled && (
          <Button
            variant="subtle"
            size="xs"
            w="fit-content"
            leftSection={<IconPlus size={14} />}
            onClick={() =>
              updateAssignments([
                ...assignments,
                [`field_${assignments.length + 1}`, "$.input"],
              ])
            }
          >
            Add assignment
          </Button>
        )}
      </Stack>
    );
  }

  if (step.type === "delay") {
    return (
      <NumberInput
        label="Delay (milliseconds)"
        description="Maximum 300000 ms (5 minutes). The worker can still stop it earlier at the workflow deadline."
        value={step.config.durationMs}
        min={1}
        max={300_000}
        disabled={disabled}
        onChange={(durationMs) =>
          typeof durationMs === "number" &&
          onChange({ ...step, config: { durationMs } })
        }
      />
    );
  }

  if (step.type === "slack_send_message") {
    const slackConnections = integrationConnections.filter(
      (connection) =>
        connection.provider === "slack" && connection.status === "active",
    );
    return (
      <Stack gap="sm">
        <Select
          label="Slack connection"
          description="Only active connections in this workspace can be used."
          placeholder="Choose a Slack connection"
          searchable
          nothingFoundMessage="No active Slack connection"
          data={slackConnections.map((connection) => ({
            value: connection.id,
            label:
              connection.providerAccountName ?? connection.providerAccountId,
          }))}
          value={step.config.connectionId}
          disabled={disabled}
          onChange={(connectionId) =>
            connectionId &&
            onChange({
              ...step,
              config: { ...step.config, connectionId },
            })
          }
        />
        <TextInput
          label="Channel ID"
          description="Use a Slack channel, group, or DM ID such as C01234567."
          placeholder="C01234567"
          value={step.config.channel}
          disabled={disabled}
          onChange={(event) =>
            onChange({
              ...step,
              config: { ...step.config, channel: event.currentTarget.value },
            })
          }
        />
        <Textarea
          label="Message"
          description="Use {{ event.payload.orderId }} to insert a scalar value from the execution context."
          value={step.config.text}
          disabled={disabled}
          minRows={3}
          maxLength={4000}
          onChange={(event) =>
            onChange({
              ...step,
              config: { ...step.config, text: event.currentTarget.value },
            })
          }
        />
      </Stack>
    );
  }

  return (
    <Textarea
      label="Expression"
      value={step.config.expression}
      disabled={disabled}
      minRows={2}
      onChange={(event) =>
        onChange({
          ...step,
          config: { expression: event.currentTarget.value },
        })
      }
    />
  );
}

export function WorkflowDraftEditor({
  initialDefinition,
  integrationConnections,
  validationErrors,
  canEdit,
  isArchived,
  isSaving,
  isValidating,
  isPublishing,
  isArchiving,
  onSave,
  onValidate,
  onPublish,
  onArchive,
}: WorkflowDraftEditorProps) {
  const [definition, setDefinition] = useState(initialDefinition);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const disabled =
    !canEdit ||
    isArchived ||
    isSaving ||
    isValidating ||
    isPublishing ||
    isArchiving;

  const updateStep = (index: number, nextStep: WorkflowStep) => {
    setDefinition((current) => ({
      ...current,
      steps: current.steps.map((step, stepIndex) =>
        stepIndex === index ? nextStep : step,
      ),
    }));
  };

  const moveStep = (index: number, offset: -1 | 1) => {
    setDefinition((current) => {
      const targetIndex = index + offset;
      if (targetIndex < 0 || targetIndex >= current.steps.length)
        return current;

      const steps = [...current.steps];
      [steps[index], steps[targetIndex]] = [steps[targetIndex], steps[index]];
      return { ...current, steps };
    });
  };

  const removeStep = (index: number) => {
    setDefinition((current) => ({
      ...current,
      steps: current.steps.filter((_, stepIndex) => stepIndex !== index),
    }));
  };

  return (
    <Stack gap="lg">
      <Card withBorder radius="md" padding="lg">
        <Group justify="space-between" align="flex-start">
          <div>
            <Group gap="xs">
              <Title order={4}>Draft definition</Title>
              <Badge variant="light" color={isArchived ? "gray" : "violet"}>
                {isArchived ? "read only" : "editable"}
              </Badge>
            </Group>
            <Text size="sm" c="dimmed" mt={4}>
              Steps run in order. Published versions are immutable; this draft
              is the next version you can change.
            </Text>
          </div>
          {canEdit && !isArchived && (
            <Group gap="xs">
              <Button
                variant="default"
                loading={isSaving}
                onClick={() => onSave(definition)}
              >
                Save draft
              </Button>
              <Button
                variant="light"
                loading={isValidating}
                onClick={onValidate}
              >
                Validate
              </Button>
              <Button
                loading={isPublishing}
                onClick={() => setPublishModalOpen(true)}
              >
                Publish
              </Button>
            </Group>
          )}
        </Group>

        {validationErrors.length > 0 && (
          <Alert color="yellow" icon={<IconAlertCircle size={18} />} mt="md">
            Validation found {validationErrors.length} issue(s). Fix them before
            publishing.
          </Alert>
        )}
      </Card>

      <Stack gap="sm">
        {definition.steps.map((step, index) => {
          const stepErrors = validationErrors.filter((error) =>
            error.path.startsWith(`steps[${index}]`),
          );

          return (
            <Card key={step.id} withBorder radius="md" padding="lg">
              <Group justify="space-between" align="flex-start" wrap="nowrap">
                <Group gap="sm" wrap="nowrap">
                  <ThemeIcon variant="light" color="violet">
                    <IconBraces size={18} />
                  </ThemeIcon>
                  <div>
                    <Text fw={650}>Step {index + 1}</Text>
                    <Text size="sm" c="dimmed">
                      {step.id}
                    </Text>
                  </div>
                </Group>
                {canEdit && !isArchived && (
                  <Group gap={4}>
                    <Tooltip label="Move up">
                      <ActionIcon
                        variant="subtle"
                        disabled={index === 0}
                        onClick={() => moveStep(index, -1)}
                      >
                        <IconArrowUp size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Move down">
                      <ActionIcon
                        variant="subtle"
                        disabled={index === definition.steps.length - 1}
                        onClick={() => moveStep(index, 1)}
                      >
                        <IconArrowDown size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Remove step">
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() => removeStep(index)}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                )}
              </Group>

              <Divider my="md" />
              <Stack gap="sm">
                <Group grow align="flex-start">
                  <TextInput
                    label="Step name"
                    value={step.name}
                    disabled={disabled}
                    onChange={(event) =>
                      updateStep(index, {
                        ...step,
                        name: event.currentTarget.value,
                      })
                    }
                  />
                  <Select
                    label="Step type"
                    value={step.type}
                    disabled={disabled}
                    data={[
                      { value: "http_request", label: "HTTP request" },
                      { value: "transform", label: "Transform" },
                      { value: "condition", label: "Condition" },
                      { value: "delay", label: "Delay" },
                      {
                        value: "slack_send_message",
                        label: "Slack: send message",
                      },
                    ]}
                    onChange={(type) =>
                      type &&
                      updateStep(
                        index,
                        replaceStepType(step, type as WorkflowStepType),
                      )
                    }
                  />
                </Group>
                <StepConfigFields
                  step={step}
                  disabled={disabled}
                  integrationConnections={integrationConnections}
                  onChange={(nextStep) => updateStep(index, nextStep)}
                />
                {stepErrors.length > 0 && (
                  <Alert color="red" variant="light">
                    <Stack gap={2}>
                      {stepErrors.map((error) => (
                        <Text key={`${error.path}-${error.code}`} size="sm">
                          {error.message}
                        </Text>
                      ))}
                    </Stack>
                  </Alert>
                )}
              </Stack>
            </Card>
          );
        })}
      </Stack>

      {canEdit && !isArchived && (
        <Group>
          <Button
            variant="light"
            leftSection={<IconPlus size={16} />}
            onClick={() =>
              setDefinition((current) => ({
                ...current,
                steps: [...current.steps, createStep("http_request")],
              }))
            }
          >
            Add HTTP request
          </Button>
          <Button
            variant="light"
            onClick={() =>
              setDefinition((current) => ({
                ...current,
                steps: [...current.steps, createStep("transform")],
              }))
            }
          >
            Add transform
          </Button>
          <Button
            variant="light"
            onClick={() =>
              setDefinition((current) => ({
                ...current,
                steps: [...current.steps, createStep("condition")],
              }))
            }
          >
            Add condition
          </Button>
          <Button
            variant="light"
            onClick={() =>
              setDefinition((current) => ({
                ...current,
                steps: [...current.steps, createStep("delay")],
              }))
            }
          >
            Add delay
          </Button>
          <Button
            variant="light"
            onClick={() =>
              setDefinition((current) => ({
                ...current,
                steps: [...current.steps, createStep("slack_send_message")],
              }))
            }
          >
            Add Slack message
          </Button>
        </Group>
      )}

      {canEdit && !isArchived && (
        <Card withBorder radius="md" padding="lg" bg="red.0">
          <Group justify="space-between">
            <div>
              <Title order={5}>Archive this workflow</Title>
              <Text size="sm" c="dimmed">
                It stays in history but cannot receive new executions.
              </Text>
            </div>
            <Button
              color="red"
              variant="light"
              onClick={() => setArchiveModalOpen(true)}
            >
              Archive
            </Button>
          </Group>
        </Card>
      )}

      <Modal
        opened={publishModalOpen}
        onClose={() => setPublishModalOpen(false)}
        title="Publish workflow version?"
        centered
      >
        <Stack>
          <Text size="sm">
            Publishing freezes this version. A new draft copy will be created
            for future edits.
          </Text>
          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => setPublishModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              leftSection={<IconSend size={16} />}
              loading={isPublishing}
              onClick={() => {
                onPublish();
                setPublishModalOpen(false);
              }}
            >
              Publish version
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={archiveModalOpen}
        onClose={() => setArchiveModalOpen(false)}
        title="Archive workflow?"
        centered
      >
        <Stack>
          <Text size="sm">
            This stops future executions. Historical versions and audit records
            stay available.
          </Text>
          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => setArchiveModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              color="red"
              loading={isArchiving}
              onClick={() => {
                onArchive();
                setArchiveModalOpen(false);
              }}
            >
              Archive workflow
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
