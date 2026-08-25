import { SlackOAuthClient } from '@hooklane/integrations';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from 'src/config/env.schema';
import { OAuthProviderError } from './oauth-provider.error';
import type {
  OAuthAuthorizationRequest,
  OAuthCodeExchangeRequest,
  OAuthProvider,
  OAuthRefreshTokenRequest,
  OAuthTokenSet,
} from './oauth-provider.types';

const SLACK_AUTHORIZE_URL = 'https://slack.com/oauth/v2/authorize';
const SLACK_DEFAULT_SCOPES = ['chat:write'];

@Injectable()
export class SlackOAuthProvider implements OAuthProvider {
  readonly provider = 'slack' as const;

  constructor(private readonly config: ConfigService<Env, true>) {}

  getRedirectUri(): string {
    return this.getConfiguration().redirectUri;
  }

  getAuthorizationScopes(): string[] {
    return [...SLACK_DEFAULT_SCOPES];
  }

  createAuthorizationUrl(request: OAuthAuthorizationRequest): URL {
    const { clientId, redirectUri } = this.getConfiguration();
    this.assertRedirectUri(request.redirectUri, redirectUri);

    const url = new URL(SLACK_AUTHORIZE_URL);
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('scope', request.scopes.join(','));
    url.searchParams.set('state', request.state);
    url.searchParams.set('code_challenge', request.codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    return url;
  }

  async exchangeAuthorizationCode(
    request: OAuthCodeExchangeRequest,
  ): Promise<OAuthTokenSet> {
    const { redirectUri } = this.getConfiguration();
    this.assertRedirectUri(request.redirectUri, redirectUri);
    return this.getClient().exchangeAuthorizationCode(request);
  }

  refreshAccessToken(
    request: OAuthRefreshTokenRequest,
  ): Promise<OAuthTokenSet> {
    return this.getClient().refreshAccessToken(request.refreshToken);
  }

  revokeAccessToken(accessToken: string): Promise<void> {
    return this.getClient().revokeAccessToken(accessToken);
  }

  private getConfiguration(): {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  } {
    const clientId = this.config.get('SLACK_CLIENT_ID', { infer: true });
    const clientSecret = this.config.get('SLACK_CLIENT_SECRET', {
      infer: true,
    });
    const redirectUri = this.config.get('SLACK_OAUTH_REDIRECT_URI', {
      infer: true,
    });

    if (
      typeof clientId !== 'string' ||
      typeof clientSecret !== 'string' ||
      typeof redirectUri !== 'string'
    ) {
      throw new OAuthProviderError('slack', 'configuration_missing', false);
    }
    return { clientId, clientSecret, redirectUri };
  }

  private getClient(): SlackOAuthClient {
    const { clientId, clientSecret } = this.getConfiguration();
    return new SlackOAuthClient({ clientId, clientSecret });
  }

  private assertRedirectUri(requestUri: string, configuredUri: string): void {
    if (requestUri !== configuredUri) {
      throw new OAuthProviderError('slack', 'configuration_missing', false);
    }
  }
}
