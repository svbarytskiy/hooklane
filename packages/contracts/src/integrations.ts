export const integrationProviders = ["slack"] as const;

export type IntegrationProvider = (typeof integrationProviders)[number];

export const integrationConnectionStatuses = [
  "active",
  "expired",
  "revoked",
  "needs_reconnect",
] as const;

export type IntegrationConnectionStatus =
  (typeof integrationConnectionStatuses)[number];

export type IntegrationConnectionSummary = {
  id: string;
  workspaceId: string;
  provider: IntegrationProvider;
  providerAccountId: string;
  providerAccountEmail: string | null;
  providerAccountName: string | null;
  status: IntegrationConnectionStatus;
  scopes: string[];
  accessTokenExpiresAt: string | null;
  refreshTokenExpiresAt: string | null;
  lastRefreshedAt: string | null;
  lastErrorCode: string | null;
  lastErrorAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
