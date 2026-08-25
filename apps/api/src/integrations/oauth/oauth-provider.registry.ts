import type { IntegrationProvider } from '@hooklane/contracts';
import { Injectable } from '@nestjs/common';
import { SlackOAuthProvider } from './slack-oauth.provider';
import type { OAuthProvider } from './oauth-provider.types';

@Injectable()
export class OAuthProviderRegistry {
  private readonly providers: ReadonlyMap<IntegrationProvider, OAuthProvider>;

  constructor(slackOAuthProvider: SlackOAuthProvider) {
    this.providers = new Map([
      [slackOAuthProvider.provider, slackOAuthProvider],
    ]);
  }

  get(provider: IntegrationProvider): OAuthProvider {
    const oauthProvider = this.providers.get(provider);

    if (!oauthProvider) {
      throw new Error(`Unsupported OAuth provider: ${provider}`);
    }

    return oauthProvider;
  }
}
