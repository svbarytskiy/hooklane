import type { IntegrationProvider } from '@hooklane/contracts';

export type OAuthAuthorizationRequest = {
  state: string;
  redirectUri: string;
  scopes: string[];
  codeChallenge: string;
};

export type OAuthCodeExchangeRequest = {
  code: string;
  redirectUri: string;
  codeVerifier: string;
};

export type OAuthRefreshTokenRequest = {
  refreshToken: string;
};

export type OAuthTokenSet = {
  accessToken: string;
  refreshToken: string | null;
  accessTokenExpiresAt: Date | null;
  scopes: string[];
  providerAccount: {
    id: string;
    name: string | null;
    email: string | null;
  };
};

export interface OAuthProvider {
  readonly provider: IntegrationProvider;

  getRedirectUri(): string;
  getAuthorizationScopes(): string[];
  createAuthorizationUrl(request: OAuthAuthorizationRequest): URL;
  exchangeAuthorizationCode(
    request: OAuthCodeExchangeRequest,
  ): Promise<OAuthTokenSet>;
  refreshAccessToken(request: OAuthRefreshTokenRequest): Promise<OAuthTokenSet>;
  revokeAccessToken(accessToken: string): Promise<void>;
}
