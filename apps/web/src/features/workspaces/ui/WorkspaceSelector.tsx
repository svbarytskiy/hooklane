import {
  Box,
  Group,
  Alert,
  Select,
  Skeleton,
  Text,
  ThemeIcon,
} from '@mantine/core';
import { IconBuilding } from '@tabler/icons-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthSession } from '../../auth/model/use-auth-session';
import { useWorkspacesQuery } from '../api/use-workspaces-query';

const selectedWorkspaceStorageKey = 'hooklane:selected-workspace-id';

export function WorkspaceSelector() {
  const { accessToken } = useAuthSession();
  const navigate = useNavigate();
  const workspacesQuery = useWorkspacesQuery(Boolean(accessToken));
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    localStorage.getItem(selectedWorkspaceStorageKey),
  );

  if (!accessToken) return null;

  if (workspacesQuery.isLoading) {
    return <Skeleton height={42} radius="sm" />;
  }

  if (workspacesQuery.isError) {
    return <Alert color="red">Could not load workspaces.</Alert>;
  }

  const workspaces = workspacesQuery.data ?? [];
  const selectedWorkspaceId = workspaces.some(
    (workspace) => workspace.id === selectedId,
  )
    ? selectedId
    : (workspaces[0]?.id ?? null);

  if (workspaces.length === 0) {
    return (
      <Group gap="xs" wrap="nowrap">
        <ThemeIcon size="sm" variant="light" color="gray">
          <IconBuilding size={14} />
        </ThemeIcon>
        <Box>
          <Text size="xs" c="dimmed">
            No workspace yet
          </Text>
          <Text component={Link} to="/workspaces" size="sm" fw={600} c="teal">
            Create one
          </Text>
        </Box>
      </Group>
    );
  }

  return (
    <Select
      label="Current workspace"
      size="sm"
      value={selectedWorkspaceId}
      onChange={(value) => {
        setSelectedId(value);
        if (value) {
          localStorage.setItem(selectedWorkspaceStorageKey, value);
          navigate(`/workspaces/${value}/workflows`);
        }
      }}
      data={workspaces.map((workspace) => ({
        value: workspace.id,
        label: workspace.name,
      }))}
      searchable={workspaces.length > 5}
      allowDeselect={false}
    />
  );
}
