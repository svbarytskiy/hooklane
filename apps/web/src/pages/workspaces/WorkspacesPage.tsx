import {
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconAlertCircle, IconBuilding, IconPlus } from '@tabler/icons-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthSession } from '../../features/auth/model/use-auth-session';
import { useCreateWorkspaceMutation } from '../../features/workspaces/api/use-create-workspace-mutation';
import { useWorkspacesQuery } from '../../features/workspaces/api/use-workspaces-query';
import { WorkspaceMembersPanel } from '../../features/workspaces/ui/WorkspaceMembersPanel';
import { getApiErrorMessage } from '../../shared/api/api-error';

type WorkspaceFormValues = {
  name: string;
  slug: string;
};

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

export function WorkspacesPage() {
  const { accessToken } = useAuthSession();
  const workspacesQuery = useWorkspacesQuery(Boolean(accessToken));
  const createWorkspaceMutation = useCreateWorkspaceMutation();
  const [slugWasEdited, setSlugWasEdited] = useState(false);
  const [membersWorkspaceId, setMembersWorkspaceId] = useState<string | null>(
    null,
  );
  const form = useForm<WorkspaceFormValues>({
    mode: 'uncontrolled',
    initialValues: { name: '', slug: '' },
    validate: {
      name: (value) =>
        value.trim().length === 0
          ? 'Give your workspace a name'
          : value.trim().length > 80
            ? 'Use 80 characters or fewer'
            : null,
      slug: (value) =>
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
          ? null
          : 'Use lowercase letters, numbers, and single hyphens',
    },
  });

  if (!accessToken) {
    return (
      <Alert icon={<IconAlertCircle size={18} />} title="Sign in required">
        Sign in first to create and manage workspaces.
      </Alert>
    );
  }

  const handleSubmit = form.onSubmit((values) => {
    createWorkspaceMutation.mutate(values, {
      onSuccess: () => {
        form.reset();
        setSlugWasEdited(false);
      },
    });
  });
  const membersWorkspace = workspacesQuery.data?.find(
    (workspace) => workspace.id === membersWorkspaceId,
  );

  return (
    <Stack gap="xl">
      <div>
        <Badge variant="light" color="teal" mb="xs">
          Workspace layer
        </Badge>
        <Title order={2}>Workspaces</Title>
        <Text c="dimmed" mt={4} maw={680}>
          Workspaces are the tenant boundary for workflows, members, billing
          entitlements, and execution history.
        </Text>
      </div>

      <Card withBorder radius="md" padding="lg">
        <Group align="flex-start" wrap="nowrap">
          <ThemeIcon size="lg" variant="light" color="teal">
            <IconPlus size={20} />
          </ThemeIcon>
          <Stack gap="md" style={{ flex: 1 }}>
            <div>
              <Title order={4}>Create a workspace</Title>
              <Text size="sm" c="dimmed" mt={4}>
                You will become its owner. You can invite teammates later.
              </Text>
            </div>
            <form onSubmit={handleSubmit}>
              <Stack gap="sm">
                <TextInput
                  label="Workspace name"
                  placeholder="Acme Automations"
                  key={form.key('name')}
                  {...form.getInputProps('name')}
                  onChange={(event) => {
                    form.getInputProps('name').onChange(event);
                    if (!slugWasEdited) {
                      form.setFieldValue(
                        'slug',
                        slugify(event.currentTarget.value),
                      );
                    }
                  }}
                />
                <TextInput
                  label="Slug"
                  description="Used in URLs and internal identifiers."
                  placeholder="acme-automations"
                  key={form.key('slug')}
                  {...form.getInputProps('slug')}
                  onChange={(event) => {
                    setSlugWasEdited(true);
                    form.getInputProps('slug').onChange(event);
                  }}
                />
                <Group justify="flex-end">
                  <Button
                    type="submit"
                    loading={createWorkspaceMutation.isPending}
                  >
                    Create workspace
                  </Button>
                </Group>
              </Stack>
            </form>
          </Stack>
        </Group>
      </Card>

      <Divider label="Your workspaces" labelPosition="left" />

      {workspacesQuery.isLoading && (
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <Skeleton height={140} />
          <Skeleton height={140} />
        </SimpleGrid>
      )}

      {workspacesQuery.isError && (
        <Alert color="red" icon={<IconAlertCircle size={18} />}>
          {getApiErrorMessage(workspacesQuery.error)}
        </Alert>
      )}

      {!workspacesQuery.isLoading &&
        !workspacesQuery.isError &&
        workspacesQuery.data?.length === 0 && (
          <Card withBorder radius="md" padding="xl" ta="center">
            <ThemeIcon size={48} radius="xl" variant="light" color="gray" mx="auto">
              <IconBuilding size={24} />
            </ThemeIcon>
            <Title order={4} mt="md">
              Your first workspace is waiting
            </Title>
            <Text c="dimmed" size="sm" mt={4}>
              Create one above to establish the first tenant boundary.
            </Text>
          </Card>
        )}

      {workspacesQuery.data && workspacesQuery.data.length > 0 && (
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          {workspacesQuery.data.map((workspace) => (
            <Card key={workspace.id} withBorder radius="md" padding="lg">
              <Group justify="space-between" align="flex-start">
                <Group gap="sm" wrap="nowrap">
                  <ThemeIcon variant="light" color="teal">
                    <IconBuilding size={18} />
                  </ThemeIcon>
                  <div>
                    <Text fw={650}>{workspace.name}</Text>
                    <Text size="sm" c="dimmed">
                      {workspace.slug}
                    </Text>
                  </div>
                </Group>
                <Badge variant="light" color="teal">
                  {workspace.role}
                </Badge>
              </Group>
              <Button
                variant="subtle"
                color="teal"
                mt="md"
                onClick={() => setMembersWorkspaceId(workspace.id)}
              >
                View members
              </Button>
              <Button
                component={Link}
                to={`/workspaces/${workspace.id}/workflows`}
                variant="light"
                color="violet"
                mt="md"
                ml="xs"
              >
                Open workflows
              </Button>
            </Card>
          ))}
        </SimpleGrid>
      )}

      {membersWorkspace && (
        <WorkspaceMembersPanel
          workspace={membersWorkspace}
          isAuthenticated={Boolean(accessToken)}
        />
      )}
    </Stack>
  );
}
