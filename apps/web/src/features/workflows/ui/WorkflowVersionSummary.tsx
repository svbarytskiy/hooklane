import {
  Badge,
  Card,
  Group,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import type { WorkflowVersionSummary as WorkflowVersion } from "@hooklane/contracts";
import { IconHistory, IconPencil, IconRocket } from "@tabler/icons-react";

type WorkflowVersionSummaryProps = {
  versions: WorkflowVersion[];
};

function formatDate(value: string | null) {
  if (!value) return "Not published";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function WorkflowVersionSummary({
  versions,
}: WorkflowVersionSummaryProps) {
  const draft = versions.find((version) => version.state === "draft");
  const latestPublished = versions.find(
    (version) => version.state === "published",
  );

  return (
    <Card withBorder radius="md" padding="lg">
      <Group justify="space-between" align="flex-start" mb="md">
        <Group gap="sm">
          <ThemeIcon variant="light" color="violet">
            <IconHistory size={18} />
          </ThemeIcon>
          <div>
            <Title order={4}>Version history</Title>
            <Text size="sm" c="dimmed">
              Published versions are immutable. The draft is the only editable
              version.
            </Text>
          </div>
        </Group>
        <Badge variant="light" color="gray">
          {versions.length} version{versions.length === 1 ? "" : "s"}
        </Badge>
      </Group>

      <Stack gap="sm">
        {draft && (
          <Group justify="space-between">
            <Group gap="xs">
              <ThemeIcon size="sm" radius="xl" variant="light" color="teal">
                <IconPencil size={14} />
              </ThemeIcon>
              <Text size="sm">Current draft v{draft.versionNumber}</Text>
            </Group>
            <Badge color="teal" variant="light">
              editable
            </Badge>
          </Group>
        )}

        {latestPublished && (
          <Group justify="space-between">
            <Group gap="xs">
              <ThemeIcon size="sm" radius="xl" variant="light" color="violet">
                <IconRocket size={14} />
              </ThemeIcon>
              <Text size="sm">
                Published v{latestPublished.versionNumber} ·{" "}
                {formatDate(latestPublished.publishedAt)}
              </Text>
            </Group>
            <Badge color="violet" variant="light">
              immutable
            </Badge>
          </Group>
        )}

        {!latestPublished && (
          <Text size="sm" c="dimmed">
            No published version yet.
          </Text>
        )}
      </Stack>
    </Card>
  );
}
