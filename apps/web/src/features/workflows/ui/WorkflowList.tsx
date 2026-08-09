import { Badge, Button, Card, Group, Stack, Text, ThemeIcon } from '@mantine/core';
import { IconArchive, IconRoute2 } from '@tabler/icons-react';
import type { WorkflowSummary } from '../../../shared/api/workflows-api';

type WorkflowListProps = {
  workflows: WorkflowSummary[];
  onOpen: (workflowId: string) => void;
};

export function WorkflowList({ workflows, onOpen }: WorkflowListProps) {
  return (
    <Stack gap="sm">
      {workflows.map((workflow) => (
        <Card key={workflow.id} withBorder radius="md" padding="lg">
          <Group justify="space-between" align="center" wrap="nowrap">
            <Group gap="sm" wrap="nowrap">
              <ThemeIcon
                variant="light"
                color={workflow.status === 'archived' ? 'gray' : 'teal'}
              >
                {workflow.status === 'archived' ? (
                  <IconArchive size={18} />
                ) : (
                  <IconRoute2 size={18} />
                )}
              </ThemeIcon>
              <div>
                <Text fw={650}>{workflow.name}</Text>
                <Text size="sm" c="dimmed">
                  {workflow.slug}
                </Text>
              </div>
            </Group>
            <Group gap="sm" wrap="nowrap">
              <Badge
                variant="light"
                color={workflow.status === 'archived' ? 'gray' : 'teal'}
              >
                {workflow.status}
              </Badge>
              <Button variant="subtle" onClick={() => onOpen(workflow.id)}>
                Open
              </Button>
            </Group>
          </Group>
        </Card>
      ))}
    </Stack>
  );
}
