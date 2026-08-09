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
import {
  useArchiveWorkflowMutation,
  usePublishWorkflowMutation,
  useUpdateWorkflowDraftMutation,
  useValidateWorkflowDraftMutation,
} from "../../features/workflows/api/use-workflow-mutations";
import { useWorkflowDraftQuery } from "../../features/workflows/api/use-workflow-draft-query";
import { useWorkflowQuery } from "../../features/workflows/api/use-workflow-query";
import { useWorkflowVersionsQuery } from "../../features/workflows/api/use-workflow-versions-query";
import { WorkflowDraftEditor } from "../../features/workflows/ui/WorkflowDraftEditor";
import { WorkflowVersionSummary } from "../../features/workflows/ui/WorkflowVersionSummary";
import { WebhookEndpointsPanel } from "../../features/webhook-endpoints/ui/WebhookEndpointsPanel";
import { useWorkspacesQuery } from "../../features/workspaces/api/use-workspaces-query";
import { getApiErrorMessage } from "../../shared/api/api-error";

export function WorkflowEditorPage() {
  const { workspaceId, workflowId } = useParams();
  const navigate = useNavigate();
  const { accessToken } = useAuthSession();
  const isAuthenticated = Boolean(accessToken);
  const workspacesQuery = useWorkspacesQuery(isAuthenticated);
  const workflowQuery = useWorkflowQuery(
    workspaceId,
    workflowId,
    isAuthenticated,
  );
  const draftQuery = useWorkflowDraftQuery(
    workspaceId,
    workflowId,
    isAuthenticated && workflowQuery.data?.status !== "archived",
  );
  const versionsQuery = useWorkflowVersionsQuery(
    workspaceId,
    workflowId,
    isAuthenticated,
  );
  const workspace = workspacesQuery.data?.find(
    (item) => item.id === workspaceId,
  );
  const canEdit = workspace?.role === "owner" || workspace?.role === "admin";
  const updateDraftMutation = useUpdateWorkflowDraftMutation(
    workspaceId ?? "",
    workflowId ?? "",
  );
  const validateDraftMutation = useValidateWorkflowDraftMutation(
    workspaceId ?? "",
    workflowId ?? "",
  );
  const publishMutation = usePublishWorkflowMutation(
    workspaceId ?? "",
    workflowId ?? "",
  );
  const archiveMutation = useArchiveWorkflowMutation(
    workspaceId ?? "",
    workflowId ?? "",
  );

  if (!accessToken) {
    return (
      <Alert icon={<IconAlertCircle size={18} />} title="Sign in required">
        Sign in to view workflows.
      </Alert>
    );
  }

  if (
    workspacesQuery.isLoading ||
    workflowQuery.isLoading ||
    versionsQuery.isLoading ||
    (workflowQuery.data?.status !== "archived" && draftQuery.isLoading)
  ) {
    return (
      <Stack gap="md">
        <Skeleton height={80} radius="md" />
        <Skeleton height={300} radius="md" />
      </Stack>
    );
  }

  const workflow = workflowQuery.data;
  const isArchived = workflow?.status === "archived";
  const hasPublishedVersion = versionsQuery.data?.some(
    (version) => version.state === "published",
  );
  const error =
    workspacesQuery.error ??
    workflowQuery.error ??
    versionsQuery.error ??
    (isArchived ? undefined : draftQuery.error);
  if (error || !workspace || !workflow) {
    return (
      <Alert color="red" icon={<IconAlertCircle size={18} />}>
        {error
          ? getApiErrorMessage(error)
          : "Workflow not found or you do not have access."}
      </Alert>
    );
  }

  const draft = draftQuery.data;

  return (
    <Stack gap="xl" maw={1080}>
      <Group justify="space-between" align="flex-start">
        <div>
          <Group gap="sm">
            <ThemeIcon
              variant="light"
              color={isArchived ? "gray" : "violet"}
              size="lg"
            >
              <IconRoute2 size={20} />
            </ThemeIcon>
            <div>
              <Group gap="xs">
                <Title order={2}>{workflow.name}</Title>
                <Badge color={isArchived ? "gray" : "teal"} variant="light">
                  {workflow.status}
                </Badge>
              </Group>
              <Text size="sm" c="dimmed">
                {workspace.name} / {workflow.slug}
              </Text>
            </div>
          </Group>
          <Text c="dimmed" mt="sm">
            {isArchived
              ? "This workflow is archived. Its history remains available, but it cannot be edited or executed."
              : `Draft v${draft?.versionNumber}. Save changes, validate the definition, then publish an immutable version.`}
          </Text>
        </div>
        <Button
          variant="subtle"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => navigate(`/workspaces/${workspaceId}/workflows`)}
        >
          All workflows
        </Button>
      </Group>

      {!canEdit && (
        <Alert color="blue" icon={<IconAlertCircle size={18} />}>
          You have member access. This draft is read-only.
        </Alert>
      )}

      {isArchived && (
        <Alert color="gray" icon={<IconAlertCircle size={18} />}>
          This workflow is archived. Its versions remain available as history.
        </Alert>
      )}

      {versionsQuery.data && (
        <WorkflowVersionSummary versions={versionsQuery.data} />
      )}

      <WebhookEndpointsPanel
        workspaceId={workspaceId ?? ""}
        workflowId={workflowId ?? ""}
        canEdit={Boolean(canEdit)}
        canCreate={
          Boolean(canEdit) && !isArchived && Boolean(hasPublishedVersion)
        }
        isAuthenticated={isAuthenticated}
      />

      {!isArchived && draft && (
        <WorkflowDraftEditor
          key={draft.id}
          initialDefinition={draft.definition}
          validationErrors={draft.validationErrors ?? []}
          canEdit={Boolean(canEdit)}
          isArchived={false}
          isSaving={updateDraftMutation.isPending}
          isValidating={validateDraftMutation.isPending}
          isPublishing={publishMutation.isPending}
          isArchiving={archiveMutation.isPending}
          onSave={(definition) => updateDraftMutation.mutate({ definition })}
          onValidate={() => validateDraftMutation.mutate()}
          onPublish={() => publishMutation.mutate()}
          onArchive={() =>
            archiveMutation.mutate(undefined, {
              onSuccess: () => navigate(`/workspaces/${workspaceId}/workflows`),
            })
          }
        />
      )}
    </Stack>
  );
}
