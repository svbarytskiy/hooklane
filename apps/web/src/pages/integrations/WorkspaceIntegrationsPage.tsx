import {
  Alert,
  Badge,
  Button,
  Group,
  Skeleton,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconAlertCircle,
  IconArrowLeft,
  IconPlugConnected,
} from "@tabler/icons-react";
import { useEffect, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuthSession } from "../../features/auth/model/use-auth-session";
import { integrationQueryKeys } from "../../features/integrations/model/integration-query-keys";
import { SlackConnectionsPanel } from "../../features/integrations/ui/SlackConnectionsPanel";
import { useWorkspacesQuery } from "../../features/workspaces/api/use-workspaces-query";
import { getApiErrorMessage } from "../../shared/api/api-error";
import { useQueryClient } from "@tanstack/react-query";

export function WorkspaceIntegrationsPage() {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const handledOAuthResult = useRef<string | null>(null);
  const { accessToken } = useAuthSession();
  const isAuthenticated = Boolean(accessToken);
  const workspacesQuery = useWorkspacesQuery(isAuthenticated);
  const workspace = workspacesQuery.data?.find(
    (item) => item.id === workspaceId,
  );
  const canManage = workspace?.role === "owner" || workspace?.role === "admin";
  const oauthResult = searchParams.get("oauth");

  useEffect(() => {
    if (
      !workspaceId ||
      !oauthResult ||
      handledOAuthResult.current === oauthResult
    ) {
      return;
    }

    handledOAuthResult.current = oauthResult;

    if (oauthResult === "slack_connected") {
      void queryClient.invalidateQueries({
        queryKey: integrationQueryKeys.connections(workspaceId),
      });
      notifications.show({
        color: "teal",
        title: "Slack connected",
        message:
          "This workspace can now use its Slack connection in workflows.",
      });
    } else if (oauthResult === "slack_failed") {
      notifications.show({
        color: "red",
        title: "Slack connection was not completed",
        message: "No connection was added. You can safely try again.",
      });
    }

    navigate(`/workspaces/${workspaceId}/integrations`, { replace: true });
  }, [navigate, oauthResult, queryClient, workspaceId]);

  if (!accessToken) {
    return (
      <Alert icon={<IconAlertCircle size={18} />} title="Sign in required">
        Sign in to inspect and manage workspace integrations.
      </Alert>
    );
  }

  if (workspacesQuery.isLoading) {
    return <Skeleton height={220} radius="md" />;
  }

  if (workspacesQuery.isError || !workspace) {
    return (
      <Alert color="red" icon={<IconAlertCircle size={18} />}>
        {workspacesQuery.isError
          ? getApiErrorMessage(workspacesQuery.error)
          : "Workspace not found or you do not have access."}
      </Alert>
    );
  }

  return (
    <Stack gap="xl" maw={1080}>
      <Group justify="space-between" align="flex-start">
        <div>
          <Group gap="sm">
            <ThemeIcon variant="light" color="violet" size="lg">
              <IconPlugConnected size={20} />
            </ThemeIcon>
            <div>
              <Badge variant="light" color="teal" mb={4}>
                {workspace.name}
              </Badge>
              <Title order={2}>Integrations</Title>
            </div>
          </Group>
          <Text c="dimmed" mt="sm" maw={680}>
            Connect external providers at the workspace boundary. Credentials
            are encrypted and stay available only to authorized workflow
            executions.
          </Text>
        </div>
        <Button
          variant="subtle"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => navigate(`/workspaces/${workspaceId}/workflows`)}
        >
          Workflows
        </Button>
      </Group>

      <SlackConnectionsPanel
        workspaceId={workspaceId as string}
        isAuthenticated={isAuthenticated}
        canManage={canManage}
      />

    </Stack>
  );
}
