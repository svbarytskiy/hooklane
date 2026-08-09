import {
  Button,
  Card,
  Group,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import type { CreateWorkflowRequest } from "@hooklane/contracts";

type WorkflowCreatePanelProps = {
  disabled: boolean;
  loading: boolean;
  onSubmit: (input: CreateWorkflowRequest) => Promise<unknown>;
};

type FormValues = CreateWorkflowRequest;

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

export function WorkflowCreatePanel({
  disabled,
  loading,
  onSubmit,
}: WorkflowCreatePanelProps) {
  const form = useForm<FormValues>({
    mode: "uncontrolled",
    initialValues: { name: "", slug: "" },
    validate: {
      name: (value) =>
        value.trim().length === 0 ? "Give your workflow a name" : null,
      slug: (value) =>
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
          ? null
          : "Use lowercase letters, numbers, and single hyphens",
    },
  });

  return (
    <Card withBorder radius="md" padding="lg">
      <Stack gap="md">
        <div>
          <Title order={4}>Create workflow</Title>
          <Text size="sm" c="dimmed" mt={4}>
            A workflow starts as an editable draft. Publishing creates an
            immutable version.
          </Text>
        </div>
        <form
          onSubmit={form.onSubmit(async (values) => {
            try {
              await onSubmit(values);
              form.reset();
            } catch {
              // The mutation hook already surfaces a useful notification.
            }
          })}
        >
          <Stack gap="sm">
            <TextInput
              label="Workflow name"
              placeholder="Order created"
              disabled={disabled}
              key={form.key("name")}
              {...form.getInputProps("name")}
              onChange={(event) => {
                form.getInputProps("name").onChange(event);
                form.setFieldValue("slug", slugify(event.currentTarget.value));
              }}
            />
            <TextInput
              label="Slug"
              description="Unique within this workspace."
              placeholder="order-created"
              disabled={disabled}
              key={form.key("slug")}
              {...form.getInputProps("slug")}
            />
            <Group justify="flex-end">
              <Button type="submit" loading={loading} disabled={disabled}>
                Create draft
              </Button>
            </Group>
          </Stack>
        </form>
      </Stack>
    </Card>
  );
}
