import { Badge, Group, SimpleGrid, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { IconDatabase, IconKey, IconServer2 } from '@tabler/icons-react';

const items = [
  {
    title: 'API shell',
    description: 'Nest backend has config, Supabase client provider, and auth guard groundwork.',
    icon: IconServer2,
    status: 'In progress',
  },
  {
    title: 'Auth flow',
    description: 'Next step is wiring Supabase browser auth and calling /auth/me with a bearer token.',
    icon: IconKey,
    status: 'Next',
  },
  {
    title: 'Database',
    description: 'Drizzle schema and Supabase migrations come after the auth handshake is proven.',
    icon: IconDatabase,
    status: 'Queued',
  },
];

export function DashboardPage() {
  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>Dashboard</Title>
        <Text c="dimmed" mt={4}>
          Starting surface for the billing lab. Keep it operational and boring on purpose.
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
    </Stack>
  );
}
