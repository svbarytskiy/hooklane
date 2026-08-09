import type {
  CreateWebhookEndpointRequest,
  WebhookEndpointSummary,
  WebhookSignatureMode,
} from "@hooklane/contracts";
import {
  Alert,
  Badge,
  Button,
  Card,
  Code,
  Group,
  Modal,
  Radio,
  Skeleton,
  Stack,
  Switch,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  Tooltip,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useClipboard } from "@mantine/hooks";
import {
  IconAlertCircle,
  IconCheck,
  IconCopy,
  IconKey,
  IconLink,
  IconLock,
  IconPlus,
  IconRefresh,
  IconWebhook,
} from "@tabler/icons-react";
import { useState } from "react";
import { getApiErrorMessage } from "../../../shared/api/api-error";
import {
  useCreateWebhookEndpointMutation,
  useRotateWebhookEndpointSecretMutation,
  useUpdateWebhookEndpointMutation,
} from "../api/use-webhook-endpoint-mutations";
import { useWebhookEndpointsQuery } from "../api/use-webhook-endpoints-query";
import { WebhookEndpointSecretModal } from "./WebhookEndpointSecretModal";

type WebhookEndpointsPanelProps = {
  workspaceId: string;
  workflowId: string;
  canEdit: boolean;
  canCreate: boolean;
  isAuthenticated: boolean;
};

type EndpointFormValues = CreateWebhookEndpointRequest & {
  signatureMode: WebhookSignatureMode;
};

type SecretDialogState = {
  endpointName: string;
  secret: string;
} | null;

function EndpointRow({
  endpoint,
  canEdit,
  isMutating,
  onToggle,
  onRotate,
}: {
  endpoint: WebhookEndpointSummary;
  canEdit: boolean;
  isMutating: boolean;
  onToggle: (endpoint: WebhookEndpointSummary) => void;
  onRotate: (endpoint: WebhookEndpointSummary) => void;
}) {
  const clipboard = useClipboard({ timeout: 1500 });
  const isHmac = endpoint.signatureMode === "hmac_sha256";

  return (
    <Card withBorder radius="md" padding="md">
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <div>
            <Group gap="xs">
              <Text fw={600}>{endpoint.name}</Text>
              <Badge
                color={endpoint.status === "active" ? "teal" : "gray"}
                variant="light"
              >
                {endpoint.status}
              </Badge>
              <Badge
                color={isHmac ? "violet" : "orange"}
                variant="outline"
                leftSection={isHmac ? <IconLock size={12} /> : undefined}
              >
                {isHmac ? "HMAC signed" : "Unsigned"}
              </Badge>
            </Group>
            <Text size="xs" c="dimmed" mt={4}>
              {isHmac
                ? "Requests must include a valid signing signature."
                : "Anyone with this URL can send requests; use only for local or trusted testing."}
            </Text>
          </div>
          <Switch
            checked={endpoint.status === "active"}
            onChange={() => onToggle(endpoint)}
            label={endpoint.status === "active" ? "Active" : "Inactive"}
            color="teal"
            disabled={!canEdit || isMutating}
          />
        </Group>

        <Group gap="xs" wrap="nowrap">
          <Code block style={{ flex: 1, overflowWrap: "anywhere" }}>
            {endpoint.url}
          </Code>
          <Tooltip label={clipboard.copied ? "Copied" : "Copy webhook URL"}>
            <Button
              variant="default"
              px="sm"
              aria-label="Copy webhook URL"
              onClick={() => clipboard.copy(endpoint.url)}
            >
              {clipboard.copied ? (
                <IconCheck size={16} />
              ) : (
                <IconCopy size={16} />
              )}
            </Button>
          </Tooltip>
        </Group>

        {isHmac && (
          <Group justify="flex-end">
            <Button
              variant="subtle"
              color="violet"
              size="xs"
              leftSection={<IconRefresh size={14} />}
              disabled={!canEdit || isMutating}
              onClick={() => onRotate(endpoint)}
            >
              Rotate secret
            </Button>
          </Group>
        )}
      </Stack>
    </Card>
  );
}

export function WebhookEndpointsPanel({
  workspaceId,
  workflowId,
  canEdit,
  canCreate,
  isAuthenticated,
}: WebhookEndpointsPanelProps) {
  const [createModalOpened, setCreateModalOpened] = useState(false);
  const [rotationTarget, setRotationTarget] =
    useState<WebhookEndpointSummary | null>(null);
  const [secretDialog, setSecretDialog] = useState<SecretDialogState>(null);
  const endpointsQuery = useWebhookEndpointsQuery(
    workspaceId,
    workflowId,
    isAuthenticated,
  );
  const createMutation = useCreateWebhookEndpointMutation(
    workspaceId,
    workflowId,
  );
  const updateMutation = useUpdateWebhookEndpointMutation(
    workspaceId,
    workflowId,
  );
  const rotateMutation = useRotateWebhookEndpointSecretMutation(
    workspaceId,
    workflowId,
  );
  const form = useForm<EndpointFormValues>({
    mode: "controlled",
    initialValues: { name: "", signatureMode: "hmac_sha256" },
    validate: {
      name: (value) =>
        value.trim().length > 0 ? null : "Give this endpoint a name",
    },
  });
  const isMutating =
    createMutation.isPending ||
    updateMutation.isPending ||
    rotateMutation.isPending;

  const handleCreate = async (values: EndpointFormValues) => {
    try {
      const result = await createMutation.mutateAsync(values);
      form.reset();
      setCreateModalOpened(false);

      if (result.signingSecret) {
        setSecretDialog({
          endpointName: result.endpoint.name,
          secret: result.signingSecret,
        });
      }
    } catch {
      // The mutation hook displays the error and leaves the form intact.
    }
  };

  const handleRotation = async () => {
    if (!rotationTarget) return;

    try {
      const result = await rotateMutation.mutateAsync(rotationTarget.id);
      setRotationTarget(null);
      setSecretDialog({
        endpointName: result.endpoint.name,
        secret: result.signingSecret,
      });
    } catch {
      // The mutation hook displays the error and keeps the confirmation open.
    }
  };

  return (
    <>
      <Card withBorder radius="lg" padding="lg">
        <Stack gap="lg">
          <Group justify="space-between" align="flex-start" wrap="wrap">
            <Group gap="sm" align="flex-start">
              <ThemeIcon variant="light" color="violet" size="lg">
                <IconWebhook size={20} />
              </ThemeIcon>
              <div>
                <Title order={3}>Webhook endpoints</Title>
                <Text size="sm" c="dimmed" mt={4}>
                  Public URLs that accept events and create workflow executions.
                </Text>
              </div>
            </Group>
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() => setCreateModalOpened(true)}
              disabled={!canCreate}
            >
              New endpoint
            </Button>
          </Group>

          {!canEdit && (
            <Alert color="blue" icon={<IconAlertCircle size={18} />}>
              Members can inspect endpoint configuration but cannot change it.
            </Alert>
          )}

          {canEdit && !canCreate && (
            <Alert color="yellow" icon={<IconAlertCircle size={18} />}>
              Publish at least one workflow version before creating a public
              endpoint.
            </Alert>
          )}

          {endpointsQuery.isLoading && (
            <Stack gap="sm">
              <Skeleton height={116} radius="md" />
              <Skeleton height={116} radius="md" />
            </Stack>
          )}

          {endpointsQuery.isError && (
            <Alert color="red" icon={<IconAlertCircle size={18} />}>
              {getApiErrorMessage(endpointsQuery.error)}
            </Alert>
          )}

          {endpointsQuery.data && endpointsQuery.data.length === 0 && (
            <Stack align="center" gap="xs" py="xl">
              <ThemeIcon variant="light" color="gray" size="xl">
                <IconLink size={22} />
              </ThemeIcon>
              <Text fw={600}>No endpoints yet</Text>
              <Text size="sm" c="dimmed" ta="center" maw={440}>
                Create a signed URL, then configure your sender to POST events
                to Hooklane.
              </Text>
            </Stack>
          )}

          {endpointsQuery.data && endpointsQuery.data.length > 0 && (
            <Stack gap="sm">
              {endpointsQuery.data.map((endpoint) => (
                <EndpointRow
                  key={endpoint.id}
                  endpoint={endpoint}
                  canEdit={canEdit}
                  isMutating={isMutating}
                  onToggle={(item) =>
                    updateMutation.mutate({
                      endpointId: item.id,
                      input: {
                        status:
                          item.status === "active" ? "inactive" : "active",
                      },
                    })
                  }
                  onRotate={setRotationTarget}
                />
              ))}
            </Stack>
          )}
        </Stack>
      </Card>

      <Modal
        opened={createModalOpened}
        onClose={() => setCreateModalOpened(false)}
        title="Create webhook endpoint"
        centered
      >
        <form onSubmit={form.onSubmit(handleCreate)}>
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              Hooklane will generate a stable public URL for this workflow.
            </Text>
            <TextInput
              label="Endpoint name"
              description="For example: Production orders or GitHub pushes."
              placeholder="Production orders"
              maxLength={80}
              disabled={isMutating}
              {...form.getInputProps("name")}
            />
            <Radio.Group
              label="Request verification"
              description="Signed requests prove that the sender knows your secret."
              value={form.values.signatureMode}
              onChange={(value) =>
                form.setFieldValue(
                  "signatureMode",
                  value as WebhookSignatureMode,
                )
              }
            >
              <Stack mt="xs" gap="xs">
                <Radio
                  value="hmac_sha256"
                  label="HMAC signed (recommended)"
                  disabled={isMutating}
                />
                <Radio
                  value="none"
                  label="Unsigned — only for local or trusted testing"
                  color="orange"
                  disabled={isMutating}
                />
              </Stack>
            </Radio.Group>
            {form.values.signatureMode === "none" && (
              <Alert color="orange" icon={<IconAlertCircle size={18} />}>
                Anyone who knows the URL can submit an event. Do not use this
                mode for a public production sender.
              </Alert>
            )}
            <Group justify="flex-end">
              <Button
                variant="default"
                disabled={isMutating}
                onClick={() => setCreateModalOpened(false)}
              >
                Cancel
              </Button>
              <Button type="submit" loading={createMutation.isPending}>
                Create endpoint
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <Modal
        opened={Boolean(rotationTarget)}
        onClose={() => setRotationTarget(null)}
        title="Rotate signing secret?"
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            The public URL for <strong>{rotationTarget?.name}</strong> will not
            change, but its current signing secret will immediately stop
            working.
          </Text>
          <Alert color="yellow" icon={<IconAlertCircle size={18} />}>
            Update the sender with the new secret as soon as you copy it.
          </Alert>
          <Group justify="flex-end">
            <Button
              variant="default"
              disabled={rotateMutation.isPending}
              onClick={() => setRotationTarget(null)}
            >
              Cancel
            </Button>
            <Button
              color="violet"
              leftSection={<IconKey size={16} />}
              loading={rotateMutation.isPending}
              onClick={handleRotation}
            >
              Rotate secret
            </Button>
          </Group>
        </Stack>
      </Modal>

      <WebhookEndpointSecretModal
        opened={Boolean(secretDialog)}
        endpointName={secretDialog?.endpointName ?? ""}
        secret={secretDialog?.secret ?? null}
        onClose={() => setSecretDialog(null)}
      />
    </>
  );
}
