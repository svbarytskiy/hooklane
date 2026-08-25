import { OAuthProviderError } from "./oauth-provider-error.js";

const SLACK_TOKEN_URL = "https://slack.com/api/oauth.v2.access";
const SLACK_REVOKE_URL = "https://slack.com/api/auth.revoke";
const REQUEST_TIMEOUT_MS = 10_000;

export type SlackOAuthClientOptions = {
  clientId: string;
  clientSecret: string;
};

export type SlackOAuthTokenSet = {
  accessToken: string;
  refreshToken: string | null;
  accessTokenExpiresAt: Date | null;
  scopes: string[];
  providerAccount: {
    id: string;
    name: string | null;
    email: null;
  };
};

type SlackTokenResponse = {
  ok?: boolean;
  error?: string;
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  team?: { id?: string; name?: string };
};

type SlackRevokeResponse = { ok?: boolean; error?: string };

export class SlackOAuthClient {
  constructor(private readonly options: SlackOAuthClientOptions) {}

  exchangeAuthorizationCode(input: {
    code: string;
    codeVerifier: string;
    redirectUri: string;
  }): Promise<SlackOAuthTokenSet> {
    return this.requestToken({
      code: input.code,
      code_verifier: input.codeVerifier,
      grant_type: "authorization_code",
      redirect_uri: input.redirectUri,
    });
  }

  refreshAccessToken(refreshToken: string): Promise<SlackOAuthTokenSet> {
    return this.requestToken({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });
  }

  async revokeAccessToken(accessToken: string): Promise<void> {
    let response: Response;
    try {
      response = await fetch(SLACK_REVOKE_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw new OAuthProviderError("slack", "provider_unavailable", true);
    }
    const body = await this.parseJson<SlackRevokeResponse>(response);
    if (!response.ok || body.ok !== true) {
      throw this.toProviderError(body.error, response.status);
    }
  }

  private async requestToken(
    parameters: Record<string, string>,
  ): Promise<SlackOAuthTokenSet> {
    let response: Response;
    try {
      response = await fetch(SLACK_TOKEN_URL, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${this.options.clientId}:${this.options.clientSecret}`,
          ).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        },
        body: new URLSearchParams(parameters),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw new OAuthProviderError("slack", "provider_unavailable", true);
    }
    const body = await this.parseJson<SlackTokenResponse>(response);
    if (!response.ok || body.ok !== true) {
      throw this.toProviderError(body.error, response.status);
    }
    if (!body.access_token || !body.team?.id) {
      throw new OAuthProviderError("slack", "provider_rejected", false);
    }
    return {
      accessToken: body.access_token,
      refreshToken: body.refresh_token ?? null,
      accessTokenExpiresAt: this.toExpirationDate(body.expires_in),
      scopes: body.scope?.split(",").filter(Boolean) ?? [],
      providerAccount: {
        id: body.team.id,
        name: body.team.name ?? null,
        email: null,
      },
    };
  }

  private async parseJson<T>(response: Response): Promise<T> {
    try {
      return (await response.json()) as T;
    } catch {
      throw new OAuthProviderError("slack", "provider_unavailable", true);
    }
  }

  private toExpirationDate(expiresIn: number | undefined): Date | null {
    if (!Number.isSafeInteger(expiresIn) || !expiresIn || expiresIn <= 0) {
      return null;
    }
    return new Date(Date.now() + expiresIn * 1_000);
  }

  private toProviderError(
    slackCode: string | undefined,
    httpStatus: number,
  ): OAuthProviderError {
    if (httpStatus === 429 || slackCode === "ratelimited") {
      return new OAuthProviderError("slack", "rate_limited", true);
    }
    if (httpStatus >= 500 || slackCode === "service_unavailable") {
      return new OAuthProviderError("slack", "provider_unavailable", true);
    }
    if (slackCode === "missing_scope" || slackCode === "no_scopes") {
      return new OAuthProviderError("slack", "missing_scope", false);
    }
    if (
      [
        "invalid_refresh_token",
        "invalid_grant",
        "token_expired",
        "token_revoked",
        "invalid_auth",
      ].includes(slackCode ?? "")
    ) {
      return new OAuthProviderError("slack", "invalid_grant", false);
    }
    return new OAuthProviderError("slack", "provider_rejected", false);
  }
}
