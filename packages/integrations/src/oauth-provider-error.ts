export type OAuthProviderErrorCode =
  | "configuration_missing"
  | "invalid_grant"
  | "invalid_token"
  | "missing_scope"
  | "rate_limited"
  | "provider_unavailable"
  | "provider_rejected";

export class OAuthProviderError extends Error {
  constructor(
    readonly provider: "slack",
    readonly code: OAuthProviderErrorCode,
    readonly retryable: boolean,
  ) {
    super(`${provider} OAuth error: ${code}`);
    this.name = "OAuthProviderError";
  }
}
