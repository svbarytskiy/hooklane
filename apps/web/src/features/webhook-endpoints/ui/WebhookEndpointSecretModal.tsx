import { Alert, Button, Code, Group, Modal, Stack, Text } from "@mantine/core";
import { useClipboard } from "@mantine/hooks";
import { IconAlertTriangle, IconCheck, IconCopy } from "@tabler/icons-react";

type WebhookEndpointSecretModalProps = {
  opened: boolean;
  endpointName: string;
  secret: string | null;
  onClose: () => void;
};

export function WebhookEndpointSecretModal({
  opened,
  endpointName,
  secret,
  onClose,
}: WebhookEndpointSecretModalProps) {
  const clipboard = useClipboard({ timeout: 1500 });

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Copy signing secret"
      centered
    >
      <Stack gap="md">
        <Text size="sm">
          Use this secret to configure <strong>{endpointName}</strong> in the
          sender that will call Hooklane.
        </Text>
        <Alert color="yellow" icon={<IconAlertTriangle size={18} />}>
          This is the only time Hooklane can show this secret. Store it in the
          sender&apos;s secret manager before closing this dialog.
        </Alert>
        <Code block>{secret}</Code>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            I copied it
          </Button>
          <Button
            leftSection={
              clipboard.copied ? (
                <IconCheck size={16} />
              ) : (
                <IconCopy size={16} />
              )
            }
            onClick={() => secret && clipboard.copy(secret)}
          >
            {clipboard.copied ? "Copied" : "Copy secret"}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
