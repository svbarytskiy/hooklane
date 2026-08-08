import {
  Alert,
  Badge,
  Card,
  Group,
  Skeleton,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { IconAlertCircle, IconUsers } from '@tabler/icons-react';
import { useWorkspaceMembersQuery } from '../api/use-workspace-members-query';
import type { WorkspaceSummary } from '../../../shared/api/workspaces-api';
import { getApiErrorMessage } from '../../../shared/api/api-error';

type WorkspaceMembersPanelProps = {
  workspace: WorkspaceSummary;
  isAuthenticated: boolean;
};

export function WorkspaceMembersPanel({
  workspace,
  isAuthenticated,
}: WorkspaceMembersPanelProps) {
  const membersQuery = useWorkspaceMembersQuery(
    workspace.id,
    isAuthenticated,
  );

  return (
    <Card withBorder radius="md" padding="lg">
      <Group gap="sm" mb="md">
        <IconUsers size={20} />
        <div>
          <Title order={4}>{workspace.name} members</Title>
          <Text size="sm" c="dimmed">
            Access is scoped to this workspace.
          </Text>
        </div>
      </Group>

      {membersQuery.isLoading && (
        <Stack gap="xs">
          <Skeleton height={36} />
          <Skeleton height={36} />
        </Stack>
      )}

      {membersQuery.isError && (
        <Alert color="red" icon={<IconAlertCircle size={18} />}>
          {getApiErrorMessage(membersQuery.error)}
        </Alert>
      )}

      {membersQuery.data?.length === 0 && (
        <Text c="dimmed" size="sm">
          This workspace has no visible members.
        </Text>
      )}

      {membersQuery.data && membersQuery.data.length > 0 && (
        <Table.ScrollContainer minWidth={460}>
          <Table verticalSpacing="sm" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Email</Table.Th>
                <Table.Th>Role</Table.Th>
                <Table.Th>Joined</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {membersQuery.data.map((member) => (
                <Table.Tr key={member.userId}>
                  <Table.Td>{member.email ?? 'Email unavailable'}</Table.Td>
                  <Table.Td>
                    <Badge variant="light">{member.role}</Badge>
                  </Table.Td>
                  <Table.Td>
                    {new Intl.DateTimeFormat(undefined, {
                      dateStyle: 'medium',
                    }).format(new Date(member.createdAt))}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    </Card>
  );
}
