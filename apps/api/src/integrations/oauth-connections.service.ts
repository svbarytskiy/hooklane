import type {
  IntegrationConnectionSummary,
  IntegrationProvider,
} from '@hooklane/contracts';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from 'src/config/env.schema';
import { IntegrationConnectionsRepository } from './integration-connections.repository';
import { OAuthProviderError } from './oauth/oauth-provider.error';
import { OAuthProviderRegistry } from './oauth/oauth-provider.registry';
import { OAuthSecurityService } from './oauth/oauth-security.service';
import { OAuthTokenCryptoService } from './oauth/oauth-token-crypto.service';

const OAUTH_STATE_TTL_MS = 10 * 60 * 1_000;

@Injectable()
export class OAuthConnectionsService {
  constructor(
    private readonly connections: IntegrationConnectionsRepository,
    private readonly providers: OAuthProviderRegistry,
    private readonly security: OAuthSecurityService,
    private readonly tokenCrypto: OAuthTokenCryptoService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async beginAuthorization(
    userId: string,
    workspaceId: string,
    providerName: IntegrationProvider,
  ): Promise<{ authorizationUrl: string }> {
    try {
      const provider = this.providers.get(providerName);
      const state = this.security.generateState();
      const { codeVerifier, codeChallenge } = this.security.createPkcePair();
      const redirectUri = provider.getRedirectUri();

      await this.connections.createAuthorizationState({
        stateHash: this.security.hashState(state),
        provider: providerName,
        workspaceId,
        userId,
        codeVerifierCiphertext: this.tokenCrypto.encrypt(codeVerifier),
        codeVerifierKeyVersion: this.tokenCrypto.getCurrentKeyVersion(),
        redirectUri,
        expiresAt: new Date(Date.now() + OAUTH_STATE_TTL_MS),
      });

      return {
        authorizationUrl: provider
          .createAuthorizationUrl({
            state,
            redirectUri,
            scopes: provider.getAuthorizationScopes(),
            codeChallenge,
          })
          .toString(),
      };
    } catch (error) {
      this.throwConfigurationError(error);
    }
  }

  async completeAuthorization(
    providerName: IntegrationProvider,
    code: string,
    state: string,
  ): Promise<{ workspaceId: string; connectionId: string }> {
    const provider = this.providers.get(providerName);
    const [authorizationState] =
      await this.connections.consumeAuthorizationState(
        providerName,
        this.security.hashState(state),
      );

    if (!authorizationState) {
      throw new BadRequestException('Invalid or expired OAuth state');
    }

    const codeVerifier = this.tokenCrypto.decrypt(
      authorizationState.codeVerifierCiphertext,
      authorizationState.codeVerifierKeyVersion,
    );
    const tokens = await provider.exchangeAuthorizationCode({
      code,
      codeVerifier,
      redirectUri: authorizationState.redirectUri,
    });
    const tokenKeyVersion = this.tokenCrypto.getCurrentKeyVersion();
    const [connection] = await this.connections.createConnection({
      workspaceId: authorizationState.workspaceId,
      provider: providerName,
      providerAccountId: tokens.providerAccount.id,
      providerAccountEmail: tokens.providerAccount.email,
      providerAccountName: tokens.providerAccount.name,
      scopes: tokens.scopes,
      accessTokenCiphertext: this.tokenCrypto.encrypt(tokens.accessToken),
      refreshTokenCiphertext: tokens.refreshToken
        ? this.tokenCrypto.encrypt(tokens.refreshToken)
        : null,
      tokenKeyVersion,
      accessTokenExpiresAt: tokens.accessTokenExpiresAt,
      refreshTokenExpiresAt: null,
      createdBy: authorizationState.userId,
    });

    if (!connection) {
      throw new Error('OAuth connection was not created');
    }

    return {
      workspaceId: authorizationState.workspaceId,
      connectionId: connection.id,
    };
  }

  async listConnections(
    workspaceId: string,
  ): Promise<IntegrationConnectionSummary[]> {
    const connections = await this.connections.listConnections(workspaceId);

    return connections.map((connection) => ({
      ...connection,
      provider: connection.provider as IntegrationProvider,
      status: connection.status as IntegrationConnectionSummary['status'],
      accessTokenExpiresAt:
        connection.accessTokenExpiresAt?.toISOString() ?? null,
      refreshTokenExpiresAt:
        connection.refreshTokenExpiresAt?.toISOString() ?? null,
      lastRefreshedAt: connection.lastRefreshedAt?.toISOString() ?? null,
      lastErrorAt: connection.lastErrorAt?.toISOString() ?? null,
      revokedAt: connection.revokedAt?.toISOString() ?? null,
      createdAt: connection.createdAt.toISOString(),
      updatedAt: connection.updatedAt.toISOString(),
    }));
  }

  async disconnectConnection(
    workspaceId: string,
    connectionId: string,
  ): Promise<void> {
    const connection = await this.connections.findConnection(
      workspaceId,
      connectionId,
    );

    if (!connection) {
      throw new NotFoundException('Integration connection not found');
    }

    if (connection.status === 'revoked') {
      return;
    }

    const provider = this.providers.get(
      connection.provider as IntegrationProvider,
    );

    try {
      await provider.revokeAccessToken(
        this.tokenCrypto.decrypt(
          connection.accessTokenCiphertext,
          connection.tokenKeyVersion,
        ),
      );
    } catch (error) {
      if (
        !(error instanceof OAuthProviderError) ||
        error.code !== 'invalid_grant'
      ) {
        throw error;
      }
    }

    await this.connections.markRevoked(connection.id);
  }

  getFrontendOAuthResultUrl(
    workspaceId: string | null,
    result: 'connected' | 'failed',
  ): string {
    const webUrl = this.config.get('WEB_URL', { infer: true });
    const url = new URL(
      workspaceId ? `/workspaces/${workspaceId}/integrations` : '/workspaces',
      webUrl,
    );
    url.searchParams.set('oauth', `slack_${result}`);

    if (workspaceId) {
      url.searchParams.set('workspaceId', workspaceId);
    }

    return url.toString();
  }

  private throwConfigurationError(error: unknown): never {
    if (
      error instanceof OAuthProviderError ||
      (error instanceof Error &&
        error.message === 'OAuth token encryption is not configured')
    ) {
      throw new ServiceUnavailableException('Slack OAuth is not configured');
    }

    throw error;
  }
}
