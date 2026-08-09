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
import {
  IconAlertCircle,
  IconArrowLeft,
  IconRoute2,
} from "@tabler/icons-react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuthSession } from "../../features/auth/model/use-auth-session";
import { useCreateWorkflowMutation } from "../../features/workflows/api/use-workflow-mutations";
import { useWorkflowsQuery } from "../../features/workflows/api/use-workflows-query";
import { WorkflowCreatePanel } from "../../features/workflows/ui/WorkflowCreatePanel";
import { WorkflowList } from "../../features/workflows/ui/WorkflowList";
import { useWorkspacesQuery } from "../../features/workspaces/api/use-workspaces-query";
import { getApiErrorMessage } from "../../shared/api/api-error";

export function WorkflowsPage() {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const { accessToken } = useAuthSession();
  const isAuthenticated = Boolean(accessToken);
  const workspacesQuery = useWorkspacesQuery(isAuthenticated);
  const workflowsQuery = useWorkflowsQuery(workspaceId, isAuthenticated);
  const createWorkflowMutation = useCreateWorkflowMutation(workspaceId ?? "");
  const workspace = workspacesQuery.data?.find(
    (item) => item.id === workspaceId,
  );
  const canEdit = workspace?.role === "owner" || workspace?.role === "admin";

  if (!accessToken) {
    return (
      <Alert icon={<IconAlertCircle size={18} />} title="Sign in required">
        Sign in to view workflows.
      </Alert>
    );
  }

  if (workspacesQuery.isLoading) {
    return <Skeleton height={180} radius="md" />;
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
              <IconRoute2 size={20} />
            </ThemeIcon>
            <div>
              <Badge variant="light" color="teal" mb={4}>
                {workspace.name}
              </Badge>
              <Title order={2}>Workflows</Title>
            </div>
          </Group>
          <Text c="dimmed" mt="sm" maw={640}>
            Build versioned automations for this workspace. Published versions
            stay immutable while you continue editing the next draft.
          </Text>
        </div>
        <Button
          variant="subtle"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => navigate("/workspaces")}
        >
          All workspaces
        </Button>
      </Group>

      {canEdit ? (
        <WorkflowCreatePanel
          disabled={false}
          loading={createWorkflowMutation.isPending}
          onSubmit={async (input) => {
            const workflow = await createWorkflowMutation.mutateAsync(input);
            navigate(`/workspaces/${workspaceId}/workflows/${workflow.id}`);
          }}
        />
      ) : (
        <Alert color="blue" icon={<IconAlertCircle size={18} />}>
          You have member access to this workspace. Workflows are read-only.
        </Alert>
      )}

      <div>
        <Title order={3} mb="xs">
          Workspace workflows
        </Title>
        <Text size="sm" c="dimmed">
          Active workflows are ready to receive executions once endpoints are
          added. Archived workflows remain available for history.
        </Text>
      </div>

      {workflowsQuery.isLoading && (
        <Stack gap="sm">
          <Skeleton height={88} radius="md" />
          <Skeleton height={88} radius="md" />
        </Stack>
      )}

      {workflowsQuery.isError && (
        <Alert color="red" icon={<IconAlertCircle size={18} />}>
          {getApiErrorMessage(workflowsQuery.error)}
        </Alert>
      )}

      {workflowsQuery.data?.length === 0 && (
        <Alert color="gray" icon={<IconRoute2 size={18} />}>
          No workflows yet. Create your first draft above.
        </Alert>
      )}

      {workflowsQuery.data && workflowsQuery.data.length > 0 && (
        <WorkflowList
          workflows={workflowsQuery.data}
          onOpen={(workflowId) =>
            navigate(`/workspaces/${workspaceId}/workflows/${workflowId}`)
          }
        />
      )}
    </Stack>
  );
}
