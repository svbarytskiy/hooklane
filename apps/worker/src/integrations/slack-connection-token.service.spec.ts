/// <reference types="jest" />

jest.mock("../database/worker-database.service", () => ({
  WorkerDatabaseService: class WorkerDatabaseService {},
}));

import { OAuthProviderError, SlackOAuthClient } from "@hooklane/integrations";
import { ConfigService } from "@nestjs/config";
import { SlackConnectionTokenService } from "./slack-connection-token.service";

const workspaceId = "00000000-0000-4000-8000-000000000001";
const connectionId = "00000000-0000-4000-8000-000000000002";

function createConnection(overrides = {}) {
  return {
    id: connectionId,
    accessTokenCiphertext: "access-ciphertext",
    refreshTokenCiphertext: "refresh-ciphertext",
    tokenKeyVersion: 1,
    accessTokenExpiresAt: new Date(Date.now() + 5_000),
    ...overrides,
  };
}

function createService(connection = createConnection()) {
  const database = {
    getActiveSlackConnection: jest.fn().mockResolvedValue(connection),
    updateRefreshedSlackConnection: jest.fn().mockResolvedValue(true),
    markSlackConnectionNeedsReconnect: jest.fn().mockResolvedValue(undefined),
  };
  const crypto = {
    decrypt: jest.fn((value: string) =>
      value === "refresh-ciphertext" ? "old-refresh-token" : "old-access-token",
    ),
    encrypt: jest.fn((value: string) => `encrypted-${value}`),
    getCurrentKeyVersion: jest.fn().mockReturnValue(1),
  };
  const release = jest.fn().mockResolvedValue(undefined);
  const locks = { tryAcquire: jest.fn().mockResolvedValue(release) };
  const config = new ConfigService({
    SLACK_CLIENT_ID: "123.456",
    SLACK_CLIENT_SECRET: "client-secret",
  });

  return {
    database,
    crypto,
    locks,
    release,
    service: new SlackConnectionTokenService(
      database as never,
      crypto as never,
      locks as never,
      config as never,
    ),
  };
}

describe("SlackConnectionTokenService", () => {
  afterEach(() => jest.restoreAllMocks());

  it("refreshes an expiring token, atomically stores the rotated pair, and releases the lock", async () => {
    const { service, database, crypto, release } = createService();
    jest
      .spyOn(SlackOAuthClient.prototype, "refreshAccessToken")
      .mockResolvedValue({
        accessToken: "new-access-token",
        refreshToken: "new-refresh-token",
        accessTokenExpiresAt: new Date("2026-12-01T00:00:00.000Z"),
        scopes: ["chat:write"],
        providerAccount: { id: "T123", name: "Hooklane", email: null },
      });

    await expect(
      service.getAccessToken(workspaceId, connectionId, "notify-slack"),
    ).resolves.toBe("new-access-token");

    expect(database.updateRefreshedSlackConnection).toHaveBeenCalledWith(
      connectionId,
      "refresh-ciphertext",
      expect.objectContaining({
        accessTokenCiphertext: "encrypted-new-access-token",
        refreshTokenCiphertext: "encrypted-new-refresh-token",
        scopes: ["chat:write"],
      }),
    );
    expect(crypto.decrypt).toHaveBeenCalledWith("refresh-ciphertext", 1);
    expect(release).toHaveBeenCalled();
  });

  it("marks the connection for reconnect when Slack rejects its refresh token", async () => {
    const { service, database } = createService();
    jest
      .spyOn(SlackOAuthClient.prototype, "refreshAccessToken")
      .mockRejectedValue(
        new OAuthProviderError("slack", "invalid_grant", false),
      );

    await expect(
      service.getAccessToken(workspaceId, connectionId, "notify-slack"),
    ).rejects.toMatchObject({
      code: "integration_connection_unavailable",
      retryable: false,
    });
    expect(database.markSlackConnectionNeedsReconnect).toHaveBeenCalledWith(
      connectionId,
      "invalid_grant",
    );
  });

  it("uses a still-valid access token without taking the refresh lock", async () => {
    const { service, crypto, locks } = createService(
      createConnection({
        accessTokenExpiresAt: new Date(Date.now() + 120_000),
      }),
    );

    await expect(
      service.getAccessToken(workspaceId, connectionId, "notify-slack"),
    ).resolves.toBe("old-access-token");
    expect(locks.tryAcquire).not.toHaveBeenCalled();
    expect(crypto.decrypt).toHaveBeenCalledWith("access-ciphertext", 1);
  });
});
