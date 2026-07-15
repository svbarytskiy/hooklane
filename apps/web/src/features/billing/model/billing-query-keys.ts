export const billingQueryKeys = {
  all: ["billing"] as const,
  state: () => [...billingQueryKeys.all, "state"] as const,
  payments: () => [...billingQueryKeys.all, "payments"] as const,
  credits: () => [...billingQueryKeys.all, "credits"] as const,
};
