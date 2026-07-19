import { notifications } from "@mantine/notifications";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiErrorMessage } from "../../../shared/api/api-error";
import {
  deleteAvatarObject,
  saveAvatarMetadata,
  uploadAvatarObject,
} from "./profile-avatar-storage";
import { profileAvatarQueryKeys } from "../model/profile-avatar-query-keys";

type UploadAvatarInput = {
  userId: string;
  file: File;
  currentObjectPath: string | null;
};

type UploadAvatarResult = {
  oldObjectCleanupFailed: boolean;
};

export function useUploadAvatarMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      file,
      currentObjectPath,
    }: UploadAvatarInput): Promise<UploadAvatarResult> => {
      const uploadedObjectPath = await uploadAvatarObject(userId, file);

      try {
        await saveAvatarMetadata(userId, uploadedObjectPath, file);
      } catch (metadataError) {
        try {
          await deleteAvatarObject(uploadedObjectPath);
        } catch (cleanupError) {
          throw new AggregateError(
            [metadataError, cleanupError],
            "Avatar metadata save and uploaded file cleanup both failed",
            { cause: cleanupError },
          );
        }

        throw metadataError;
      }

      if (!currentObjectPath || currentObjectPath === uploadedObjectPath) {
        return { oldObjectCleanupFailed: false };
      }

      try {
        await deleteAvatarObject(currentObjectPath);
        return { oldObjectCleanupFailed: false };
      } catch {
        return { oldObjectCleanupFailed: true };
      }
    },

    onSuccess: async ({ oldObjectCleanupFailed }, { userId }) => {
      await queryClient.invalidateQueries({
        queryKey: profileAvatarQueryKeys.byUser(userId),
      });

      notifications.show({
        color: oldObjectCleanupFailed ? "yellow" : "green",
        title: oldObjectCleanupFailed
          ? "Avatar updated with a warning"
          : "Avatar updated",
        message: oldObjectCleanupFailed
          ? "The previous file could not be removed and requires cleanup."
          : "Your profile avatar is now up to date.",
      });
    },

    onError: (error) => {
      notifications.show({
        color: "red",
        title: "Avatar upload failed",
        message: getApiErrorMessage(error),
      });
    },
  });
}
