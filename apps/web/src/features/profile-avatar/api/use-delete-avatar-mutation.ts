import { notifications } from "@mantine/notifications";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiErrorMessage } from "../../../shared/api/api-error";
import {
  deleteAvatarMetadata,
  deleteAvatarObject,
} from "./profile-avatar-storage";
import { profileAvatarQueryKeys } from "../model/profile-avatar-query-keys";

type DeleteAvatarInput = {
  userId: string;
  objectPath: string;
};

type DeleteAvatarResult = {
  objectCleanupFailed: boolean;
};

export function useDeleteAvatarMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      objectPath,
    }: DeleteAvatarInput): Promise<DeleteAvatarResult> => {
      await deleteAvatarMetadata(userId);

      try {
        await deleteAvatarObject(objectPath);
        return { objectCleanupFailed: false };
      } catch {
        return { objectCleanupFailed: true };
      }
    },

    onSuccess: async ({ objectCleanupFailed }, { userId }) => {
      await queryClient.invalidateQueries({
        queryKey: profileAvatarQueryKeys.byUser(userId),
      });

      notifications.show({
        color: objectCleanupFailed ? "yellow" : "green",
        title: objectCleanupFailed
          ? "Avatar removed with a warning"
          : "Avatar removed",
        message: objectCleanupFailed
          ? "The profile was cleared, but the stored file requires cleanup."
          : "The avatar was removed from your profile.",
      });
    },

    onError: (error) => {
      notifications.show({
        color: "red",
        title: "Avatar removal failed",
        message: getApiErrorMessage(error),
      });
    },
  });
}
