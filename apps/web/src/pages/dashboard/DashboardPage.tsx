import {
  Badge,
  Code,
  Group,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { IconDatabase, IconKey, IconServer2, IconUserCircle } from '@tabler/icons-react';
import { getApiErrorMessage } from '../../shared/api/api-error';
import { useAuthSession } from '../../features/auth/model/use-auth-session';
import { useMyProfileQuery } from '../../features/profiles/api/use-my-profile-query';

const items = [
  {
    title: 'API shell',
    description: 'Nest backend has config, Supabase client provider, auth guard, and Drizzle DB provider.',
    icon: IconServer2,
    status: 'Ready',
  },
  {
    title: 'Auth flow',
    description: 'Supabase browser auth sends bearer tokens to protected Nest endpoints.',
    icon: IconKey,
    status: 'Ready',
  },
  {
    title: 'Database',
    description: 'Supabase migrations own schema; Drizzle is used as the typed query layer.',
    icon: IconDatabase,
    status: 'In progress',
  },
];

export function DashboardPage() {
  const { accessToken } = useAuthSession();
  const profileQuery = useMyProfileQuery(accessToken);

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>Dashboard</Title>
        <Text c="dimmed" mt={4}>
          Operational surface for the billing lab.
        </Text>
      </div>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Stack key={item.title} gap="sm" className="surface-panel">
              <Group justify="space-between" align="flex-start">
                <ThemeIcon variant="light" size="lg">
                  <Icon size={20} />
                </ThemeIcon>
                <Badge variant="light" color="gray">
                  {item.status}
                </Badge>
              </Group>
              <div>
                <Title order={4}>{item.title}</Title>
                <Text c="dimmed" size="sm" mt={6}>
                  {item.description}
                </Text>
              </div>
            </Stack>
          );
        })}
      </SimpleGrid>

      <Stack gap="sm" className="surface-panel">
        <Group gap="sm">
          <ThemeIcon variant="light" size="lg">
            <IconUserCircle size={20} />
          </ThemeIcon>
          <div>
            <Title order={4}>Current profile</Title>
            <Text c="dimmed" size="sm">
              Reads public.profiles through Nest /profiles/me and Drizzle.
            </Text>
          </div>
        </Group>

        {!accessToken && <Text size="sm">Sign in on the Auth page to load your profile.</Text>}
        {profileQuery.isLoading && <Text size="sm">Loading profile...</Text>}
        {profileQuery.isError && (
          <Text size="sm" c="red">
            {getApiErrorMessage(profileQuery.error)}
          </Text>
        )}
        {profileQuery.data && <Code block>{JSON.stringify(profileQuery.data, null, 2)}</Code>}
      </Stack>
    </Stack>
  );
}
