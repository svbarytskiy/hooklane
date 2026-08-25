import { ConfigService } from '@nestjs/config';
import type { Env } from 'src/config/env.schema';
import { OAuthProviderError } from './oauth-provider.error';
import { SlackOAuthProvider } from './slack-oauth.provider';

const redirectUri = 'https://api.example.test/oauth/slack/callback';

function createProvider(): SlackOAuthProvider {
  const values: Partial<Env> = {
    SLACK_CLIENT_ID: '123.456',
    SLACK_CLIENT_SECRET: 'client-secret',
    SLACK_OAUTH_REDIRECT_URI: redirectUri,
  };
  const config = {
    get: jest.fn((name: keyof Env) => values[name]),
  } as unknown as ConfigService<Env, true>;

  return new SlackOAuthProvider(config);
}

describe('SlackOAuthProvider', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('creates a Slack V2 authorize URL with PKCE', () => {
    const url = createProvider().createAuthorizationUrl({
      state: 'state-value',
      redirectUri,
      scopes: ['chat:write', 'channels:read'],
      codeChallenge: 'challenge-value',
    });

    expect(url.toString()).toContain('https://slack.com/oauth/v2/authorize?');
    expect(url.searchParams.get('client_id')).toBe('123.456');
    expect(url.searchParams.get('redirect_uri')).toBe(redirectUri);
    expect(url.searchParams.get('scope')).toBe('chat:write,channels:read');
    expect(url.searchParams.get('state')).toBe('state-value');
    expect(url.searchParams.get('code_challenge')).toBe('challenge-value');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('exchanges a code using HTTP Basic client authentication', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          access_token: 'xoxe-access-token',
          refresh_token: 'xoxe-refresh-token',
          expires_in: 3600,
          scope: 'chat:write,channels:read',
          team: { id: 'T123', name: 'Hooklane' },
        }),
        { status: 200 },
      ),
    );

    const result = await createProvider().exchangeAuthorizationCode({
      code: 'temporary-code',
      codeVerifier: 'verifier-value',
      redirectUri,
    });

    expect(result).toEqual(
      expect.objectContaining({
        accessToken: 'xoxe-access-token',
        refreshToken: 'xoxe-refresh-token',
        scopes: ['chat:write', 'channels:read'],
        providerAccount: { id: 'T123', name: 'Hooklane', email: null },
      }),
    );
    const [, request] = (global.fetch as jest.Mock).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(request.body).toBeInstanceOf(URLSearchParams);
    const form = request.body as URLSearchParams;
    expect(form.get('code')).toBe('temporary-code');
    expect(form.get('code_verifier')).toBe('verifier-value');
    expect(request.headers).toEqual(
      expect.objectContaining({
        Authorization: `Basic ${Buffer.from('123.456:client-secret').toString(
          'base64',
        )}`,
      }),
    );
  });

  it('normalizes Slack rate limits into a retryable provider error', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: false, error: 'ratelimited' }), {
        status: 429,
      }),
    );

    await expect(
      createProvider().refreshAccessToken({
        refreshToken: 'xoxe-refresh-token',
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<OAuthProviderError>>({
        provider: 'slack',
        code: 'rate_limited',
        retryable: true,
      }),
    );
  });
});
