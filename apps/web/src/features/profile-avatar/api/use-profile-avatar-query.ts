import { useQuery } from "@tanstack/react-query";
import { createAvatarSignedUrl, getMyAvatar } from "./profile-avatar-storage";
import { profileAvatarQueryKeys } from "../model/profile-avatar-query-keys";

const SIGNED_URL_REFRESH_INTERVAL_MS = 4 * 60 * 1000;

async function getProfileAvatarView(userId: string) {
  const metadata = await getMyAvatar(userId);

  if (!metadata) return null;

  const signedUrl = await createAvatarSignedUrl(metadata.object_path);

  return {
    metadata,
    signedUrl,
  };
}

export function useProfileAvatarQuery(userId: string | undefined) {
  return useQuery({
    queryKey: profileAvatarQueryKeys.byUser(userId ?? "anonymous"),
    queryFn: () => {
      if (!userId) {
        throw new Error("Authenticated user is required to load an avatar");
      }

      return getProfileAvatarView(userId);
    },
    enabled: Boolean(userId),
    staleTime: SIGNED_URL_REFRESH_INTERVAL_MS,
    refetchInterval: (query) =>
      query.state.data ? SIGNED_URL_REFRESH_INTERVAL_MS : false,
  });
}
