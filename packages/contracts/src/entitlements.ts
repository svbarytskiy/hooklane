export type EntitlementLimits = {
  maxPublishedWorkflows: number;
  maxIntegrations: number;
  maxExecutionsPerPeriod: number;
  maxConcurrentExecutions: number;
  executionRetentionDays: number;
};

export type WorkspaceEntitlementResponse = {
  workspaceId: string;
  billingOwnerUserId: string;
  plan: {
    code: string;
    version: number;
    name: string;
    limits: EntitlementLimits;
  };
  source: "free" | "stripe_subscription" | "manual";
  status: "active" | "grace" | "suspended";
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  graceEndsAt: string | null;
};
