export const billingQueryKeys = {
  all: ["billing"] as const,
  state: () => [...billingQueryKeys.all, "state"] as const,
  payments: () => [...billingQueryKeys.all, "payments"] as const,
  credits: () => [...billingQueryKeys.all, "credits"] as const,
  subscription: () => [...billingQueryKeys.all, "subscription"] as const,
  invoices: () => [...billingQueryKeys.all, "invoices"] as const,
  upcomingInvoice: () =>
    [...billingQueryKeys.all, "invoices", "upcoming"] as const,
};
