import type {
  CreateWebhookEndpointRequest,
  CreateWebhookEndpointResponse,
  RotateWebhookEndpointSecretResponse,
  UpdateWebhookEndpointRequest,
  WebhookEndpointSummary,
  WebhookSignatureMode,
} from '@hooklane/contracts';
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, desc, eq } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import type { Env } from 'src/config/env.schema';
import { DATABASE } from 'src/database/database.tokens';
import type { Database } from 'src/database/database.types';
import { isUniqueConstraintViolation } from 'src/database/postgres-error';
import {
  webhookEndpoints,
  workflowVersions,
  workflows,
} from 'src/database/schema';
import { WebhookSecretCryptoService } from './webhook-secret-crypto.service';

const PUBLIC_ID_GENERATION_ATTEMPTS = 3;

type WebhookEndpointSummaryRow = Pick<
  typeof webhookEndpoints.$inferSelect,
  | 'id'
  | 'workflowId'
  | 'name'
  | 'publicId'
  | 'status'
  | 'signatureMode'
  | 'secretLastRotatedAt'
  | 'createdAt'
  | 'updatedAt'
>;

@Injectable()
export class WebhookEndpointsService {
  constructor(
    @Inject(DATABASE)
    private readonly db: Database,
    private readonly webhookSecretCrypto: WebhookSecretCryptoService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async listWebhookEndpoints(
    workspaceId: string,
    workflowId: string,
  ): Promise<WebhookEndpointSummary[]> {
    await this.getWorkflowInWorkspace(workspaceId, workflowId);

    const endpoints = await this.db
      .select({
        id: webhookEndpoints.id,
        workflowId: webhookEndpoints.workflowId,
        name: webhookEndpoints.name,
        publicId: webhookEndpoints.publicId,
        status: webhookEndpoints.status,
        signatureMode: webhookEndpoints.signatureMode,
        secretLastRotatedAt: webhookEndpoints.secretLastRotatedAt,
        createdAt: webhookEndpoints.createdAt,
        updatedAt: webhookEndpoints.updatedAt,
      })
      .from(webhookEndpoints)
      .where(
        and(
          eq(webhookEndpoints.workspaceId, workspaceId),
          eq(webhookEndpoints.workflowId, workflowId),
        ),
      )
      .orderBy(desc(webhookEndpoints.createdAt));

    return endpoints.map((endpoint) => this.toSummary(endpoint));
  }

  async createWebhookEndpoint(
    userId: string,
    workspaceId: string,
    workflowId: string,
    request: CreateWebhookEndpointRequest,
  ): Promise<CreateWebhookEndpointResponse> {
    try {
      return await this.db.transaction(async (tx) => {
        const workflow = await this.getWorkflowInWorkspace(
          workspaceId,
          workflowId,
          tx,
        );

        if (workflow.status !== 'active') {
          throw new ConflictException(
            'Webhook endpoints cannot be created for an archived workflow',
          );
        }

        const [publishedVersion] = await tx
          .select({ id: workflowVersions.id })
          .from(workflowVersions)
          .where(
            and(
              eq(workflowVersions.workflowId, workflowId),
              eq(workflowVersions.state, 'published'),
            ),
          )
          .limit(1);

        if (!publishedVersion) {
          throw new ConflictException(
            'Publish the workflow before creating a webhook endpoint',
          );
        }

        const signatureMode = request.signatureMode ?? 'hmac_sha256';
        const signingSecret =
          signatureMode === 'hmac_sha256'
            ? this.webhookSecretCrypto.generateSecret()
            : null;
        const signingSecretCiphertext = signingSecret
          ? this.webhookSecretCrypto.encrypt(signingSecret)
          : null;
        const secretLastRotatedAt = signingSecret ? new Date() : null;

        for (
          let attempt = 0;
          attempt < PUBLIC_ID_GENERATION_ATTEMPTS;
          attempt += 1
        ) {
          const [endpoint] = await tx
            .insert(webhookEndpoints)
            .values({
              workspaceId,
              workflowId,
              name: request.name.trim(),
              publicId: this.generatePublicId(),
              signatureMode,
              signingSecretCiphertext,
              secretLastRotatedAt,
              createdBy: userId,
            })
            .onConflictDoNothing({ target: webhookEndpoints.publicId })
            .returning();

          if (endpoint) {
            return {
              endpoint: this.toSummary(endpoint),
              signingSecret,
            };
          }
        }

        throw new Error('Could not generate a unique webhook endpoint ID');
      });
    } catch (error) {
      if (
        isUniqueConstraintViolation(
          error,
          'webhook_endpoints_workflow_name_unique',
        )
      ) {
        throw new ConflictException(
          'An endpoint with this name already exists for the workflow',
        );
      }

      throw error;
    }
  }

  async updateWebhookEndpoint(
    workspaceId: string,
    workflowId: string,
    endpointId: string,
    request: UpdateWebhookEndpointRequest,
  ): Promise<WebhookEndpointSummary> {
    await this.getWorkflowInWorkspace(workspaceId, workflowId);

    const [updatedEndpoint] = await this.db
      .update(webhookEndpoints)
      .set({ status: request.status, updatedAt: new Date() })
      .where(
        and(
          eq(webhookEndpoints.id, endpointId),
          eq(webhookEndpoints.workspaceId, workspaceId),
          eq(webhookEndpoints.workflowId, workflowId),
        ),
      )
      .returning();

    if (!updatedEndpoint) {
      throw new NotFoundException('Webhook endpoint not found');
    }

    return this.toSummary(updatedEndpoint);
  }

  async rotateWebhookEndpointSecret(
    workspaceId: string,
    workflowId: string,
    endpointId: string,
  ): Promise<RotateWebhookEndpointSecretResponse> {
    await this.getWorkflowInWorkspace(workspaceId, workflowId);

    const endpoint = await this.getWebhookEndpointInWorkflow(
      workspaceId,
      workflowId,
      endpointId,
    );

    if (endpoint.signatureMode !== 'hmac_sha256') {
      throw new ConflictException(
        'Only HMAC webhook endpoints have a signing secret to rotate',
      );
    }

    const signingSecret = this.webhookSecretCrypto.generateSecret();
    const secretLastRotatedAt = new Date();
    const [rotatedEndpoint] = await this.db
      .update(webhookEndpoints)
      .set({
        signingSecretCiphertext:
          this.webhookSecretCrypto.encrypt(signingSecret),
        secretLastRotatedAt,
        updatedAt: secretLastRotatedAt,
      })
      .where(eq(webhookEndpoints.id, endpoint.id))
      .returning();

    if (!rotatedEndpoint) {
      throw new Error('Webhook endpoint secret was not rotated');
    }

    return {
      endpoint: this.toSummary(rotatedEndpoint),
      signingSecret,
    };
  }

  private generatePublicId(): string {
    return `wh_${randomBytes(24).toString('base64url')}`;
  }

  private async getWorkflowInWorkspace(
    workspaceId: string,
    workflowId: string,
    db: Database = this.db,
  ): Promise<{ id: string; status: string }> {
    const [workflow] = await db
      .select({ id: workflows.id, status: workflows.status })
      .from(workflows)
      .where(
        and(
          eq(workflows.id, workflowId),
          eq(workflows.workspaceId, workspaceId),
        ),
      )
      .limit(1);

    if (!workflow) {
      throw new NotFoundException('Workflow not found');
    }

    return workflow;
  }

  private async getWebhookEndpointInWorkflow(
    workspaceId: string,
    workflowId: string,
    endpointId: string,
  ): Promise<typeof webhookEndpoints.$inferSelect> {
    const [endpoint] = await this.db
      .select()
      .from(webhookEndpoints)
      .where(
        and(
          eq(webhookEndpoints.id, endpointId),
          eq(webhookEndpoints.workspaceId, workspaceId),
          eq(webhookEndpoints.workflowId, workflowId),
        ),
      )
      .limit(1);

    if (!endpoint) {
      throw new NotFoundException('Webhook endpoint not found');
    }

    return endpoint;
  }

  private toSummary(
    endpoint: WebhookEndpointSummaryRow,
  ): WebhookEndpointSummary {
    return {
      id: endpoint.id,
      workflowId: endpoint.workflowId,
      name: endpoint.name,
      publicId: endpoint.publicId,
      url: new URL(
        `/hooks/${endpoint.publicId}`,
        this.config.get('API_URL', { infer: true }),
      ).toString(),
      status: endpoint.status as WebhookEndpointSummary['status'],
      signatureMode: endpoint.signatureMode as WebhookSignatureMode,
      secretLastRotatedAt: endpoint.secretLastRotatedAt?.toISOString() ?? null,
      createdAt: endpoint.createdAt.toISOString(),
      updatedAt: endpoint.updatedAt.toISOString(),
    };
  }
}
