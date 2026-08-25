import type { IntegrationConnectionSummary } from "@hooklane/contracts";
import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  Skeleton,
  Stack,
  Text,
  ThemeIcon,
  Tooltip,
} from "@mantine/core";
import {
  IconAlertCircle,
  IconBrandSlack,
  IconLink,
  IconPlugConnected,
  IconPlugConnectedX,
  IconRefresh,
  IconShieldLock,
} from "@tabler/icons-react";
import { useState } from "react";
import { getApiErrorMessage } from "../../../shared/api/api-error";
import {
  useBeginSlackAuthorizationMutation,
  useDisconnectIntegrationMutation,
} from "../api/use-integration-mutations";
import { useIntegrationConnectionsQuery } from "../api/use-integration-connections-query";

type Props = {
  workspaceId: string;
  isAuthenticated: boolean;
  canManage: boolean;
};

function formatDate(value: string | null): string | null {
  if (!value) return null;

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function connectionColor(status: IntegrationConnectionSummary["status"]) {
  if (status === "active") return "teal";
  if (status === "needs_reconnect" || status === "expired") return "yellow";
  return "gray";
}

function connectionLabel(status: IntegrationConnectionSummary["status"]) {
  if (status === "needs_reconnect") return "Reconnect required";
  return status;
}

function ConnectionCard({
  connection,
  canManage,
  isDisconnecting,
  onDisconnect,
  onReconnect,
}: {
  connection: IntegrationConnectionSummary;
  canManage: boolean;
  isDisconnecting: boolean;
  onDisconnect: (connection: IntegrationConnectionSummary) => void;
  onReconnect: () => void;
}) {
  const expiry = formatDate(connection.accessTokenExpiresAt);
  const needsReconnect =
    connection.status === "expired" || connection.status === "needs_reconnect";

  return (
    <Card withBorder radius="md" padding="md">
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <Group gap="sm" wrap="nowrap">
            <ThemeIcon size="lg" radius="md" variant="light" color="violet">
              <IconBrandSlack size={20} />
            </ThemeIcon>
            <div>
              <Text fw={650}>
                {connection.providerAccountName ?? "Slack workspace"}
              </Text>
              <Text size="sm" c="dimmed">
                {connection.providerAccountEmail ??
                  connection.providerAccountId}
              </Text>
            </div>
          </Group>
          <Badge color={connectionColor(connection.status)} variant="light">
            {connectionLabel(connection.status)}
          </Badge>
        </Group>

        <Group gap="xs">
          {connection.scopes.map((scope) => (
            <Badge key={scope} size="sm" variant="outline" color="violet">
              {scope}
            </Badge>
          ))}
        </Group>

        <Stack gap={2}>
          {expiry && (
            <Text size="xs" c="dimmed">
              Access token expires: {expiry}
            </Text>
          )}
          {connection.lastErrorCode && (
            <Text size="xs" c="red">
              Last provider error: {connection.lastErrorCode}
            </Text>
          )}
          {connection.revokedAt && (
            <Text size="xs" c="dimmed">
              Disconnected: {formatDate(connection.revokedAt)}
            </Text>
          )}
        </Stack>

        {canManage && connection.status !== "revoked" && (
          <Group justify="flex-end">
            {needsReconnect && (
              <Button
                size="xs"
                variant="light"
                leftSection={<IconRefresh size={14} />}
                onClick={onReconnect}
              >
                Reconnect
              </Button>
            )}
            <Button
              size="xs"
              variant="subtle"
              color="red"
              leftSection={<IconPlugConnectedX size={14} />}
              loading={isDisconnecting}
              onClick={() => onDisconnect(connection)}
            >
              Disconnect
            </Button>
          </Group>
        )}
      </Stack>
    </Card>
  );
}

export function SlackConnectionsPanel({
  workspaceId,
  isAuthenticated,
  canManage,
}: Props) {
  const connectionsQuery = useIntegrationConnectionsQuery(
    workspaceId,
    isAuthenticated,
  );
  const beginAuthorization = useBeginSlackAuthorizationMutation(workspaceId);
  const disconnectMutation = useDisconnectIntegrationMutation(workspaceId);
  const [disconnectTarget, setDisconnectTarget] =
    useState<IntegrationConnectionSummary | null>(null);
  const slackConnections = connectionsQuery.data?.filter(
    (connection) => connection.provider === "slack",
  );

  const connect = () => beginAuthorization.mutate();

  return (
    <>
      <Card withBorder radius="lg" padding="lg">
        <Stack gap="lg">
          <Group justify="space-between" align="flex-start" wrap="wrap">
            <Group gap="sm" align="flex-start">
              <ThemeIcon size="lg" variant="light" color="violet">
                <IconBrandSlack size={20} />
              </ThemeIcon>
              <div>
                <Text fw={650}>Slack</Text>
                <Text size="sm" c="dimmed" mt={4} maw={640}>
                  Let published workflows send messages through a connected
                  Slack workspace. Hooklane stores OAuth tokens encrypted and
                  requests only the scopes this action needs.
                </Text>
              </div>
            </Group>
            <Tooltip
              label={
                canManage
                  ? "Connect a Slack workspace"
                  : "Only workspace owners and admins can manage integrations"
              }
            >
              <Button
                leftSection={<IconLink size={16} />}
                loading={beginAuthorization.isPending}
                disabled={!canManage}
                onClick={connect}
              >
                Connect Slack
              </Button>
            </Tooltip>
          </Group>

          {!canManage && (
            <Alert color="blue" icon={<IconAlertCircle size={18} />}>
              You can inspect integration status, but only workspace owners and
              admins can connect or disconnect Slack.
            </Alert>
          )}

          <Alert
            color="violet"
            icon={<IconShieldLock size={18} />}
            variant="light"
          >
            Access and refresh tokens never appear in this page. They are
            encrypted before storage and decrypted only server-side for provider
            calls.
          </Alert>

          {connectionsQuery.isLoading && <Skeleton height={160} radius="md" />}

          {connectionsQuery.isError && (
            <Alert color="red" icon={<IconAlertCircle size={18} />}>
              {getApiErrorMessage(connectionsQuery.error)}
            </Alert>
          )}

          {!connectionsQuery.isLoading &&
            !connectionsQuery.isError &&
            slackConnections?.length === 0 && (
              <Alert color="gray" icon={<IconPlugConnected size={18} />}>
                No Slack workspace is connected yet.
              </Alert>
            )}

          {slackConnections && slackConnections.length > 0 && (
            <Stack gap="sm">
              {slackConnections.map((connection) => (
                <ConnectionCard
                  key={connection.id}
                  connection={connection}
                  canManage={canManage}
                  isDisconnecting={
                    disconnectMutation.isPending &&
                    disconnectMutation.variables === connection.id
                  }
                  onDisconnect={setDisconnectTarget}
                  onReconnect={connect}
                />
              ))}
            </Stack>
          )}
        </Stack>
      </Card>

      <Modal
        opened={Boolean(disconnectTarget)}
        onClose={() => setDisconnectTarget(null)}
        title="Disconnect Slack?"
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            Future workflow executions will no longer be allowed to use{" "}
            <strong>
              {disconnectTarget?.providerAccountName ?? "this Slack workspace"}
            </strong>
            .
          </Text>
          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => setDisconnectTarget(null)}
              disabled={disconnectMutation.isPending}
            >
              Keep connected
            </Button>
            <Button
              color="red"
              loading={disconnectMutation.isPending}
              onClick={() => {
                if (!disconnectTarget) return;
                disconnectMutation.mutate(disconnectTarget.id, {
                  onSuccess: () => setDisconnectTarget(null),
                });
              }}
            >
              Disconnect
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
