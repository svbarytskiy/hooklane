import {
  Alert,
  Avatar,
  Button,
  FileButton,
  Group,
  Loader,
  Modal,
  Stack,
  Text,
} from "@mantine/core";
import { IconPhotoUp, IconTrash } from "@tabler/icons-react";
import { useState } from "react";
import { getApiErrorMessage } from "../../../shared/api/api-error";
import { useDeleteAvatarMutation } from "../api/use-delete-avatar-mutation";
import { useProfileAvatarQuery } from "../api/use-profile-avatar-query";
import { useUploadAvatarMutation } from "../api/use-upload-avatar-mutation";

type ProfileAvatarPanelProps = {
  userId: string;
  label: string;
};

function formatFileSize(sizeBytes: number): string {
  return `${(sizeBytes / 1024).toFixed(1)} KB`;
}

export function ProfileAvatarPanel({ userId, label }: ProfileAvatarPanelProps) {
  const [deleteModalOpened, setDeleteModalOpened] = useState(false);
  const avatarQuery = useProfileAvatarQuery(userId);
  const uploadMutation = useUploadAvatarMutation();
  const deleteMutation = useDeleteAvatarMutation();

  const avatar = avatarQuery.data;
  const isMutating = uploadMutation.isPending || deleteMutation.isPending;

  const handleFileChange = (file: File | null) => {
    if (!file) return;

    uploadMutation.mutate({
      userId,
      file,
      currentObjectPath: avatar?.metadata.object_path ?? null,
    });
  };

  const handleDelete = () => {
    if (!avatar) return;

    deleteMutation.mutate(
      {
        userId,
        objectPath: avatar.metadata.object_path,
      },
      {
        onSuccess: () => setDeleteModalOpened(false),
      },
    );
  };

  if (avatarQuery.isLoading) {
    return (
      <Group gap="sm">
        <Loader size="sm" />
        <Text size="sm" c="dimmed">
          Loading avatar...
        </Text>
      </Group>
    );
  }

  return (
    <>
      <Stack gap="sm">
        <Group align="center" wrap="wrap">
          <Avatar
            src={avatar?.signedUrl}
            alt="Profile avatar"
            size={96}
            radius="sm"
          >
            {label.slice(0, 2).toUpperCase()}
          </Avatar>

          <Stack gap={6}>
            <Group gap="xs">
              <FileButton
                onChange={handleFileChange}
                accept="image/jpeg,image/png,image/webp"
              >
                {(props) => (
                  <Button
                    {...props}
                    leftSection={<IconPhotoUp size={16} />}
                    loading={uploadMutation.isPending}
                    disabled={deleteMutation.isPending}
                  >
                    {avatar ? "Replace avatar" : "Upload avatar"}
                  </Button>
                )}
              </FileButton>

              {avatar && (
                <Button
                  variant="light"
                  color="red"
                  leftSection={<IconTrash size={16} />}
                  disabled={isMutating}
                  onClick={() => setDeleteModalOpened(true)}
                >
                  Delete
                </Button>
              )}
            </Group>

            <Text size="xs" c="dimmed">
              JPEG, PNG or WebP, up to 5 MB
            </Text>

            {avatar && (
              <Text size="xs" c="dimmed">
                {avatar.metadata.mime_type} ?{" "}
                {formatFileSize(avatar.metadata.size_bytes)}
              </Text>
            )}
          </Stack>
        </Group>

        {avatarQuery.isError && (
          <Alert color="red" title="Avatar could not be loaded">
            {getApiErrorMessage(avatarQuery.error)}
          </Alert>
        )}
      </Stack>

      <Modal
        opened={deleteModalOpened}
        onClose={() => setDeleteModalOpened(false)}
        title="Delete avatar?"
        centered
      >
        <Stack>
          <Text size="sm">
            The current avatar will be removed from your profile.
          </Text>
          <Group justify="flex-end">
            <Button
              variant="default"
              disabled={deleteMutation.isPending}
              onClick={() => setDeleteModalOpened(false)}
            >
              Cancel
            </Button>
            <Button
              color="red"
              leftSection={<IconTrash size={16} />}
              loading={deleteMutation.isPending}
              onClick={handleDelete}
            >
              Delete avatar
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
