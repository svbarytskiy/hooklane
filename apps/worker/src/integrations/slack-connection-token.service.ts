import { OAuthProviderError, SlackOAuthClient } from "@hooklane/integrations";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { WorkerDatabaseService } from "../database/worker-database.service";
import type { WorkerEnv } from "../config/env.schema";
import { WorkflowRuntimeError } from "../runtime/workflow-runtime.error";
import { IntegrationRefreshLockService } from "./integration-refresh-lock.service";
import { OAuthTokenDecryptorService } from "./oauth-token-decryptor.service";

const REFRESH_EARLY_MS = 60_000;
const REFRESH_WAIT_ATTEMPTS = 20;
const REFRESH_WAIT_DELAY_MS = 250;

@Injectable()
export class SlackConnectionTokenService {
  constructor(
    private readonly database: WorkerDatabaseService,
    private readonly crypto: OAuthTokenDecryptorService,
    private readonly locks: IntegrationRefreshLockService,
    private readonly config: ConfigService<WorkerEnv, true>,
  ) {}

  async getAccessToken(
    workspaceId: string,
    connectionId: string,
    stepId: string,
  ): Promise<string> {
    const connection = await this.database.getActiveSlackConnection(
      workspaceId,
      connectionId,
    );
    if (!connection) throw this.connectionUnavailable(connectionId, stepId);
    if (!this.shouldRefresh(connection.accessTokenExpiresAt)) {
      return this.decryptAccessToken(
        connection.accessTokenCiphertext,
        connection.tokenKeyVersion,
        stepId,
      );
    }
    return this.refreshOrWait(workspaceId, connectionId, stepId);
  }

  private async refreshOrWait(
    workspaceId: string,
    connectionId: string,
    stepId: string,
  ): Promise<string> {
    const release = await this.locks.tryAcquire(connectionId);
    if (!release)
      return this.waitForAnotherWorker(workspaceId, connectionId, stepId);

    try {
      const connection = await this.database.getActiveSlackConnection(
        workspaceId,
        connectionId,
      );
      if (!connection) throw this.connectionUnavailable(connectionId, stepId);
      if (!this.shouldRefresh(connection.accessTokenExpiresAt)) {
        return this.decryptAccessToken(
          connection.accessTokenCiphertext,
          connection.tokenKeyVersion,
          stepId,
        );
      }
      if (!connection.refreshTokenCiphertext) {
        await this.database.markSlackConnectionNeedsReconnect(
          connection.id,
          "refresh_token_missing",
        );
        throw this.needsReconnect(
          stepId,
          "Slack connection has no refresh token; reconnect it",
        );
      }

      const refreshToken = this.decryptAccessToken(
        connection.refreshTokenCiphertext,
        connection.tokenKeyVersion,
        stepId,
      );
      try {
        const tokens = await this.getClient().refreshAccessToken(refreshToken);
        if (!tokens.refreshToken) {
          throw new Error(
            "Slack refresh response did not include a new refresh token",
          );
        }
        const updated = await this.database.updateRefreshedSlackConnection(
          connection.id,
          connection.refreshTokenCiphertext,
          {
            accessTokenCiphertext: this.crypto.encrypt(tokens.accessToken),
            refreshTokenCiphertext: this.crypto.encrypt(tokens.refreshToken),
            tokenKeyVersion: this.crypto.getCurrentKeyVersion(),
            accessTokenExpiresAt: tokens.accessTokenExpiresAt,
            scopes: tokens.scopes,
          },
        );
        if (!updated)
          return this.waitForAnotherWorker(workspaceId, connectionId, stepId);
        return tokens.accessToken;
      } catch (error) {
        if (
          error instanceof OAuthProviderError &&
          error.code === "invalid_grant"
        ) {
          await this.database.markSlackConnectionNeedsReconnect(
            connection.id,
            error.code,
          );
          throw this.needsReconnect(
            stepId,
            "Slack authorization is no longer valid; reconnect it",
          );
        }
        if (error instanceof OAuthProviderError && error.retryable) {
          throw new WorkflowRuntimeError(
            {
              code: "slack_upstream_error",
              category: "upstream",
              message: "Slack token refresh is temporarily unavailable",
              stepId,
            },
            { cause: error },
          );
        }
        throw new WorkflowRuntimeError(
          {
            code: "integration_token_unavailable",
            category: "authentication",
            message: "Slack connection token refresh failed",
            retryable: false,
            stepId,
          },
          { cause: error },
        );
      }
    } finally {
      await release();
    }
  }

  private async waitForAnotherWorker(
    workspaceId: string,
    connectionId: string,
    stepId: string,
  ): Promise<string> {
    for (let attempt = 0; attempt < REFRESH_WAIT_ATTEMPTS; attempt += 1) {
      await new Promise((resolve) =>
        setTimeout(resolve, REFRESH_WAIT_DELAY_MS),
      );
      const connection = await this.database.getActiveSlackConnection(
        workspaceId,
        connectionId,
      );
      if (!connection) throw this.connectionUnavailable(connectionId, stepId);
      if (!this.shouldRefresh(connection.accessTokenExpiresAt)) {
        return this.decryptAccessToken(
          connection.accessTokenCiphertext,
          connection.tokenKeyVersion,
          stepId,
        );
      }
    }
    throw new WorkflowRuntimeError({
      code: "slack_upstream_error",
      category: "upstream",
      message: "Slack token refresh is already in progress",
      stepId,
    });
  }

  private decryptAccessToken(
    ciphertext: string,
    keyVersion: number,
    stepId: string,
  ): string {
    try {
      return this.crypto.decrypt(ciphertext, keyVersion);
    } catch (error) {
      throw new WorkflowRuntimeError(
        {
          code: "integration_token_unavailable",
          category: "authentication",
          message: "Slack connection token could not be decrypted",
          retryable: false,
          stepId,
        },
        { cause: error },
      );
    }
  }

  private getClient(): SlackOAuthClient {
    const clientId = this.config.get("SLACK_CLIENT_ID", { infer: true });
    const clientSecret = this.config.get("SLACK_CLIENT_SECRET", {
      infer: true,
    });
    if (typeof clientId !== "string" || typeof clientSecret !== "string") {
      throw new WorkflowRuntimeError({
        code: "integration_token_unavailable",
        category: "authentication",
        message: "Slack OAuth client credentials are not configured",
        retryable: false,
      });
    }
    return new SlackOAuthClient({ clientId, clientSecret });
  }

  private shouldRefresh(expiresAt: Date | null): boolean {
    return (
      expiresAt !== null && expiresAt.getTime() <= Date.now() + REFRESH_EARLY_MS
    );
  }

  private connectionUnavailable(
    connectionId: string,
    stepId: string,
  ): WorkflowRuntimeError {
    return new WorkflowRuntimeError({
      code: "integration_connection_unavailable",
      category: "authentication",
      message: `Slack connection ${connectionId} is unavailable for this workspace`,
      retryable: false,
      stepId,
    });
  }

  private needsReconnect(
    stepId: string,
    message: string,
  ): WorkflowRuntimeError {
    return new WorkflowRuntimeError({
      code: "integration_connection_unavailable",
      category: "authentication",
      message,
      retryable: false,
      stepId,
    });
  }
}
