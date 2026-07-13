export const billingQueryKeys = {
  all: ['billing'] as const,
  state: () => [...billingQueryKeys.all, 'state'] as const,
};
