export const profileAvatarQueryKeys = {
  all: ["profile-avatar"] as const,
  byUser: (userId: string) => [...profileAvatarQueryKeys.all, userId] as const,
};
