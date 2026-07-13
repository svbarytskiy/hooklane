import { Badge, Button, Group, Stack, Table, Text, Title } from '@mantine/core';
import { IconCreditCard } from '@tabler/icons-react';

const rows = [
  { flow: 'Stripe customer', status: 'Not started', endpoint: 'POST /billing/customer' },
  { flow: 'One-time credits', status: 'Queued', endpoint: 'POST /billing/checkout/credits' },
  { flow: 'Subscription', status: 'Queued', endpoint: 'POST /billing/checkout/subscription' },
];

export function BillingOverviewPage() {
  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={2}>Billing</Title>
          <Text c="dimmed" mt={4}>
            Placeholder workspace for upcoming Stripe flows.
          </Text>
        </div>
        <Button leftSection={<IconCreditCard size={18} />} disabled>
          Create customer
        </Button>
      </Group>

      <Table.ScrollContainer minWidth={620} className="surface-panel">
        <Table verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Flow</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>API contract</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((row) => (
              <Table.Tr key={row.flow}>
                <Table.Td>{row.flow}</Table.Td>
                <Table.Td>
                  <Badge variant="light" color="gray">
                    {row.status}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text ff="monospace" size="sm">
                    {row.endpoint}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Stack>
  );
}
