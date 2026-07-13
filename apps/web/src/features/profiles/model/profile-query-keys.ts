export const profileQueryKeys = {
  all: ['profiles'] as const,
  me: () => [...profileQueryKeys.all, 'me'] as const,
};
