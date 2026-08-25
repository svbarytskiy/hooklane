import type {
  IntegrationConnectionStatus,
  IntegrationProvider,
} from '@hooklane/contracts';

export type CreateIntegrationConnectionInput = {
  workspaceId: string;
  provider: IntegrationProvider;
  providerAccountId: string;
  providerAccountEmail: string | null;
  providerAccountName: string | null;
  scopes: string[];
  accessTokenCiphertext: string;
  refreshTokenCiphertext: string | null;
  tokenKeyVersion: number;
  accessTokenExpiresAt: Date | null;
  refreshTokenExpiresAt: Date | null;
  createdBy: string;
};

export type CreateOAuthAuthorizationStateInput = {
  stateHash: string;
  provider: IntegrationProvider;
  workspaceId: string;
  userId: string;
  codeVerifierCiphertext: string;
  codeVerifierKeyVersion: number;
  redirectUri: string;
  expiresAt: Date;
};

export type UpdateIntegrationConnectionTokensInput = {
  accessTokenCiphertext: string;
  refreshTokenCiphertext: string | null;
  tokenKeyVersion: number;
  accessTokenExpiresAt: Date | null;
  refreshTokenExpiresAt: Date | null;
  status: Extract<IntegrationConnectionStatus, 'active' | 'expired'>;
  lastRefreshedAt: Date;
};
