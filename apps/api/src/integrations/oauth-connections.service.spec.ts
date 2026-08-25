import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from 'src/config/env.schema';
import { OAuthProviderError } from './oauth/oauth-provider.error';
import { OAuthConnectionsService } from './oauth-connections.service';

const authorizationState = {
  id: 'state-id',
  stateHash: 'state-hash',
  provider: 'slack',
  workspaceId: 'workspace-id',
  userId: 'user-id',
  codeVerifierCiphertext: 'encrypted-verifier',
  codeVerifierKeyVersion: 1,
  redirectUri: 'https://api.example.test/oauth/slack/callback',
  expiresAt: new Date('2026-09-01T12:10:00.000Z'),
  consumedAt: null,
  createdAt: new Date('2026-09-01T12:00:00.000Z'),
};

function createService(overrides?: {
  consumeAuthorizationState?: jest.Mock;
  revokeAccessToken?: jest.Mock;
}) {
  const provider = {
    provider: 'slack' as const,
    getRedirectUri: jest.fn().mockReturnValue(authorizationState.redirectUri),
    getAuthorizationScopes: jest.fn().mockReturnValue(['chat:write']),
    createAuthorizationUrl: jest
      .fn()
      .mockReturnValue(new URL('https://slack.example.test/authorize')),
    exchangeAuthorizationCode: jest.fn().mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      accessTokenExpiresAt: new Date('2026-09-01T13:00:00.000Z'),
      scopes: ['chat:write'],
      providerAccount: {
        id: 'T123',
        name: 'Hooklane',
        email: null,
      },
    }),
    refreshAccessToken: jest.fn(),
    revokeAccessToken: overrides?.revokeAccessToken ?? jest.fn(),
  };
  const connections = {
    createAuthorizationState: jest.fn().mockResolvedValue([]),
    consumeAuthorizationState:
      overrides?.consumeAuthorizationState ??
      jest.fn().mockResolvedValue([authorizationState]),
    createConnection: jest.fn().mockResolvedValue([{ id: 'connection-id' }]),
    listConnections: jest.fn().mockResolvedValue([]),
    findConnection: jest.fn(),
    markRevoked: jest.fn().mockResolvedValue([]),
  };
  const security = {
    generateState: jest.fn().mockReturnValue('raw-state'),
    hashState: jest.fn().mockReturnValue('state-hash'),
    createPkcePair: jest.fn().mockReturnValue({
      codeVerifier: 'verifier',
      codeChallenge: 'challenge',
    }),
  };
  const tokenCrypto = {
    encrypt: jest.fn((value: string) => `encrypted-${value}`),
    decrypt: jest.fn().mockReturnValue('verifier'),
    getCurrentKeyVersion: jest.fn().mockReturnValue(1),
  };
  const providers = { get: jest.fn().mockReturnValue(provider) };
  const config = {
    get: jest.fn().mockReturnValue('https://web.example.test'),
  } as unknown as ConfigService<Env, true>;

  return {
    service: new OAuthConnectionsService(
      connections as never,
      providers as never,
      security,
      tokenCrypto as never,
      config,
    ),
    connections,
    provider,
    security,
    tokenCrypto,
  };
}

describe('OAuthConnectionsService', () => {
  it('binds an authorization state to the current user and workspace', async () => {
    const { service, connections, provider, tokenCrypto } = createService();

    await expect(
      service.beginAuthorization('user-id', 'workspace-id', 'slack'),
    ).resolves.toEqual({
      authorizationUrl: 'https://slack.example.test/authorize',
    });

    expect(connections.createAuthorizationState).toHaveBeenCalledWith(
      expect.objectContaining({
        stateHash: 'state-hash',
        provider: 'slack',
        workspaceId: 'workspace-id',
        userId: 'user-id',
        codeVerifierCiphertext: 'encrypted-verifier',
        codeVerifierKeyVersion: 1,
        redirectUri: authorizationState.redirectUri,
      }),
    );
    expect(provider.createAuthorizationUrl).toHaveBeenCalledWith({
      state: 'raw-state',
      redirectUri: authorizationState.redirectUri,
      scopes: ['chat:write'],
      codeChallenge: 'challenge',
    });
    expect(tokenCrypto.encrypt).toHaveBeenCalledWith('verifier');
  });

  it('consumes state before exchanging the code and encrypts tokens before persistence', async () => {
    const { service, connections, provider, tokenCrypto } = createService();

    await expect(
      service.completeAuthorization('slack', 'temporary-code', 'raw-state'),
    ).resolves.toEqual({
      workspaceId: 'workspace-id',
      connectionId: 'connection-id',
    });

    expect(connections.consumeAuthorizationState).toHaveBeenCalledWith(
      'slack',
      'state-hash',
    );
    expect(provider.exchangeAuthorizationCode).toHaveBeenCalledWith({
      code: 'temporary-code',
      codeVerifier: 'verifier',
      redirectUri: authorizationState.redirectUri,
    });
    expect(connections.createConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        accessTokenCiphertext: 'encrypted-access-token',
        refreshTokenCiphertext: 'encrypted-refresh-token',
        tokenKeyVersion: 1,
      }),
    );
    expect(tokenCrypto.decrypt).toHaveBeenCalledWith('encrypted-verifier', 1);
  });

  it('does not call Slack when state is missing, expired, or previously consumed', async () => {
    const { service, provider } = createService({
      consumeAuthorizationState: jest.fn().mockResolvedValue([]),
    });

    await expect(
      service.completeAuthorization('slack', 'temporary-code', 'raw-state'),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(provider.exchangeAuthorizationCode).not.toHaveBeenCalled();
  });

  it('marks a connection revoked when Slack reports its token was already invalid', async () => {
    const revokeAccessToken = jest
      .fn()
      .mockRejectedValue(
        new OAuthProviderError('slack', 'invalid_grant', false),
      );
    const { service, connections, tokenCrypto } = createService({
      revokeAccessToken,
    });
    connections.findConnection.mockResolvedValue({
      id: 'connection-id',
      workspaceId: 'workspace-id',
      provider: 'slack',
      status: 'active',
      accessTokenCiphertext: 'encrypted-access-token',
      tokenKeyVersion: 1,
    });
    tokenCrypto.decrypt.mockReturnValue('access-token');

    await expect(
      service.disconnectConnection('workspace-id', 'connection-id'),
    ).resolves.toBeUndefined();

    expect(connections.markRevoked).toHaveBeenCalledWith('connection-id');
  });
});
