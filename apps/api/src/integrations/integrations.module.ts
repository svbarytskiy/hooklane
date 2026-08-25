import { Module } from '@nestjs/common';
import { DatabaseModule } from 'src/database/database.module';
import { IntegrationConnectionsRepository } from './integration-connections.repository';
import { OAuthConnectionsController } from './oauth-connections.controller';
import { OAuthConnectionsService } from './oauth-connections.service';
import { OAuthProviderRegistry } from './oauth/oauth-provider.registry';
import { OAuthSecurityService } from './oauth/oauth-security.service';
import { OAuthTokenCryptoService } from './oauth/oauth-token-crypto.service';
import { SlackOAuthProvider } from './oauth/slack-oauth.provider';
import { SlackOAuthCallbackController } from './slack-oauth-callback.controller';

@Module({
  imports: [DatabaseModule],
  providers: [
    IntegrationConnectionsRepository,
    OAuthProviderRegistry,
    OAuthSecurityService,
    OAuthTokenCryptoService,
    SlackOAuthProvider,
    OAuthConnectionsService,
  ],
  exports: [
    IntegrationConnectionsRepository,
    OAuthProviderRegistry,
    OAuthSecurityService,
    OAuthTokenCryptoService,
  ],
  controllers: [OAuthConnectionsController, SlackOAuthCallbackController],
})
export class IntegrationsModule {}
