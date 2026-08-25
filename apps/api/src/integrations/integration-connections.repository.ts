import type { IntegrationProvider } from '@hooklane/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { DATABASE } from 'src/database/database.tokens';
import type { Database } from 'src/database/database.types';
import {
  integrationConnections,
  oauthAuthorizationStates,
} from 'src/database/schema';
import type {
  CreateIntegrationConnectionInput,
  CreateOAuthAuthorizationStateInput,
  UpdateIntegrationConnectionTokensInput,
} from './integration-connections.types';

@Injectable()
export class IntegrationConnectionsRepository {
  constructor(
    @Inject(DATABASE)
    private readonly db: Database,
  ) {}

  createConnection(input: CreateIntegrationConnectionInput) {
    return this.db
      .insert(integrationConnections)
      .values(input)
      .onConflictDoUpdate({
        target: [
          integrationConnections.workspaceId,
          integrationConnections.provider,
          integrationConnections.providerAccountId,
        ],
        set: {
          providerAccountEmail: input.providerAccountEmail,
          providerAccountName: input.providerAccountName,
          status: 'active',
          scopes: input.scopes,
          accessTokenCiphertext: input.accessTokenCiphertext,
          refreshTokenCiphertext: input.refreshTokenCiphertext,
          tokenKeyVersion: input.tokenKeyVersion,
          accessTokenExpiresAt: input.accessTokenExpiresAt,
          refreshTokenExpiresAt: input.refreshTokenExpiresAt,
          lastRefreshedAt: new Date(),
          lastErrorCode: null,
          lastErrorAt: null,
          revokedAt: null,
          updatedAt: new Date(),
        },
      })
      .returning();
  }

  listConnections(workspaceId: string) {
    return this.db.query.integrationConnections.findMany({
      columns: {
        accessTokenCiphertext: false,
        refreshTokenCiphertext: false,
        tokenKeyVersion: false,
        createdBy: false,
      },
      where: eq(integrationConnections.workspaceId, workspaceId),
      orderBy: [desc(integrationConnections.createdAt)],
    });
  }

  findConnection(workspaceId: string, connectionId: string) {
    return this.db.query.integrationConnections.findFirst({
      where: and(
        eq(integrationConnections.workspaceId, workspaceId),
        eq(integrationConnections.id, connectionId),
      ),
    });
  }

  findConnectionByProviderAccount(
    workspaceId: string,
    provider: IntegrationProvider,
    providerAccountId: string,
  ) {
    return this.db.query.integrationConnections.findFirst({
      where: and(
        eq(integrationConnections.workspaceId, workspaceId),
        eq(integrationConnections.provider, provider),
        eq(integrationConnections.providerAccountId, providerAccountId),
      ),
    });
  }

  updateTokens(
    connectionId: string,
    input: UpdateIntegrationConnectionTokensInput,
  ) {
    return this.db
      .update(integrationConnections)
      .set({
        ...input,
        lastErrorCode: null,
        lastErrorAt: null,
        updatedAt: new Date(),
      })
      .where(eq(integrationConnections.id, connectionId))
      .returning();
  }

  markRevoked(connectionId: string, revokedAt = new Date()) {
    return this.db
      .update(integrationConnections)
      .set({
        status: 'revoked',
        revokedAt,
        updatedAt: revokedAt,
      })
      .where(eq(integrationConnections.id, connectionId))
      .returning();
  }

  createAuthorizationState(input: CreateOAuthAuthorizationStateInput) {
    return this.db.insert(oauthAuthorizationStates).values(input).returning();
  }

  consumeAuthorizationState(
    provider: IntegrationProvider,
    stateHash: string,
    consumedAt = new Date(),
  ) {
    return this.db
      .update(oauthAuthorizationStates)
      .set({ consumedAt })
      .where(
        and(
          eq(oauthAuthorizationStates.stateHash, stateHash),
          eq(oauthAuthorizationStates.provider, provider),
          isNull(oauthAuthorizationStates.consumedAt),
          gt(oauthAuthorizationStates.expiresAt, consumedAt),
        ),
      )
      .returning();
  }
}
