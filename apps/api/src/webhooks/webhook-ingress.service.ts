import type { IncomingEventReceipt } from '@hooklane/contracts';
import {
  BadRequestException,
  ConflictException,
  GoneException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { DATABASE } from 'src/database/database.tokens';
import type { Database } from 'src/database/database.types';
import {
  executions,
  executionOutbox,
  incomingEvents,
  webhookEndpoints,
  workflowVersions,
  workflows,
} from 'src/database/schema';
import { WebhookSecretCryptoService } from './webhook-secret-crypto.service';
import { WebhookSignatureService } from './webhook-signature.service';
import { WorkflowExecutionProducer } from 'src/queues/workflow-execution.producer';

const MAX_WEBHOOK_PAYLOAD_BYTES = 256 * 1024;
const MAX_SOURCE_EVENT_ID_LENGTH = 200;

type AcceptWebhookInput = {
  publicId: string;
  rawBody: Buffer;
  payload: unknown;
  contentType: string;
  sourceEventId?: string;
  timestampHeader?: string;
  signatureHeader?: string;
};

@Injectable()
export class WebhookIngressService {
  constructor(
    @Inject(DATABASE)
    private readonly db: Database,
    private readonly webhookSecretCrypto: WebhookSecretCryptoService,
    private readonly webhookSignature: WebhookSignatureService,
    private readonly executionProducer: WorkflowExecutionProducer,
  ) {}

  async acceptWebhook(
    input: AcceptWebhookInput,
  ): Promise<IncomingEventReceipt> {
    this.validatePayload(input);

    const payloadSha256 = createHash('sha256')
      .update(input.rawBody)
      .digest('hex');
    const sourceEventId = this.normalizeSourceEventId(input.sourceEventId);
    const contentType = input.contentType.split(';')[0].trim().toLowerCase();

    const result = await this.db.transaction(async (tx) => {
      const endpoint = await this.findEndpoint(tx, input.publicId);

      if (!endpoint) {
        throw new NotFoundException('Webhook endpoint not found');
      }

      if (endpoint.status !== 'active') {
        throw new GoneException('Webhook endpoint is inactive');
      }

      if (endpoint.workflowStatus !== 'active') {
        throw new GoneException('Webhook workflow is archived');
      }

      if (endpoint.signatureMode === 'hmac_sha256') {
        if (!endpoint.signingSecretCiphertext) {
          throw new InternalServerErrorException(
            'Webhook endpoint signing secret is not configured',
          );
        }

        if (!input.timestampHeader || !input.signatureHeader) {
          throw new BadRequestException(
            'Signed webhook requires timestamp and signature headers',
          );
        }

        const secret = this.webhookSecretCrypto.decrypt(
          endpoint.signingSecretCiphertext,
        );

        this.webhookSignature.verify(
          secret,
          input.rawBody,
          input.timestampHeader,
          input.signatureHeader,
        );
      }

      const publishedVersion = await this.findLatestPublishedVersion(
        tx,
        endpoint.workflowId,
      );

      if (!publishedVersion) {
        throw new ConflictException(
          'Webhook workflow does not have a published version',
        );
      }

      const [storedEvent] = await tx
        .insert(incomingEvents)
        .values({
          workspaceId: endpoint.workspaceId,
          webhookEndpointId: endpoint.id,
          workflowId: endpoint.workflowId,
          workflowVersionId: publishedVersion.id,
          sourceEventId,
          contentType,
          payload: input.payload,
          payloadSha256,
          payloadSizeBytes: input.rawBody.length,
          status: 'accepted',
        })
        .onConflictDoNothing({
          target: [
            incomingEvents.webhookEndpointId,
            incomingEvents.sourceEventId,
          ],
        })
        .returning({ id: incomingEvents.id });

      if (!storedEvent) {
        if (!sourceEventId) {
          throw new InternalServerErrorException(
            'Webhook event was not stored',
          );
        }

        const existingEvent = await this.findEventBySourceId(
          tx,
          endpoint.id,
          sourceEventId,
        );

        if (!existingEvent) {
          throw new InternalServerErrorException(
            'Duplicate webhook event could not be loaded',
          );
        }

        if (existingEvent.payloadSha256 !== payloadSha256) {
          throw new ConflictException(
            'Source event ID was already used for a different payload',
          );
        }

        const existingExecution = await this.findExecutionByEventId(
          tx,
          existingEvent.id,
        );

        if (!existingExecution) {
          throw new InternalServerErrorException(
            'Duplicate webhook execution could not be loaded',
          );
        }

        return {
          receipt: {
            eventId: existingEvent.id,
            executionId: existingExecution.id,
            status: 'accepted' as const,
            duplicate: true,
          },
          enqueue: existingExecution.status === 'pending',
          job: {
            executionId: existingExecution.id,
            incomingEventId: existingEvent.id,
            workflowVersionId: existingExecution.workflowVersionId,
            runSequence: existingExecution.runSequence,
          },
        };
      }

      const [execution] = await tx
        .insert(executions)
        .values({
          workspaceId: endpoint.workspaceId,
          workflowId: endpoint.workflowId,
          workflowVersionId: publishedVersion.id,
          runSequence: 0,
          incomingEventId: storedEvent.id,
          status: 'pending',
        })
        .returning({ id: executions.id });

      if (!execution) {
        throw new InternalServerErrorException(
          'Webhook execution was not created',
        );
      }

      await tx.insert(executionOutbox).values({
        executionId: execution.id,
      });

      return {
        receipt: {
          eventId: storedEvent.id,
          executionId: execution.id,
          status: 'accepted' as const,
          duplicate: false,
        },
        enqueue: true,
        job: {
          executionId: execution.id,
          incomingEventId: storedEvent.id,
          workflowVersionId: publishedVersion.id,
        },
      };
    });

    if (result.enqueue) {
      try {
        await this.executionProducer.enqueueExecution(result.job);
        await this.db
          .update(executions)
          .set({ status: 'queued', queuedAt: new Date() })
          .where(
            and(
              eq(executions.id, result.job.executionId),
              eq(executions.status, 'pending'),
            ),
          );
        await this.db
          .update(executionOutbox)
          .set({ status: 'published', publishedAt: new Date() })
          .where(eq(executionOutbox.executionId, result.job.executionId));
      } catch (error) {
        throw new InternalServerErrorException(
          'Webhook was stored but could not be queued',
          { cause: error },
        );
      }
    }

    return result.receipt;
  }

  private validatePayload(input: AcceptWebhookInput): void {
    if (input.rawBody.length === 0) {
      throw new BadRequestException('Webhook body cannot be empty');
    }

    if (input.rawBody.length > MAX_WEBHOOK_PAYLOAD_BYTES) {
      throw new BadRequestException('Webhook payload is too large');
    }

    if (input.payload === undefined || input.payload === null) {
      throw new BadRequestException('Webhook body must be valid JSON');
    }

    const mediaType = input.contentType.split(';')[0]?.trim().toLowerCase();

    if (mediaType !== 'application/json' && !mediaType.endsWith('+json')) {
      throw new BadRequestException('Webhook content type must be JSON');
    }
  }

  private normalizeSourceEventId(sourceEventId?: string): string | null {
    const normalized = sourceEventId?.trim() || null;

    if (normalized && normalized.length > MAX_SOURCE_EVENT_ID_LENGTH) {
      throw new BadRequestException('Webhook event ID is too long');
    }

    return normalized;
  }

  private async findEndpoint(tx: Database, publicId: string) {
    const [endpoint] = await tx
      .select({
        id: webhookEndpoints.id,
        workspaceId: webhookEndpoints.workspaceId,
        workflowId: webhookEndpoints.workflowId,
        workflowStatus: workflows.status,
        status: webhookEndpoints.status,
        signatureMode: webhookEndpoints.signatureMode,
        signingSecretCiphertext: webhookEndpoints.signingSecretCiphertext,
      })
      .from(webhookEndpoints)
      .innerJoin(workflows, eq(workflows.id, webhookEndpoints.workflowId))
      .where(eq(webhookEndpoints.publicId, publicId))
      .limit(1);

    return endpoint;
  }

  private async findLatestPublishedVersion(tx: Database, workflowId: string) {
    const [version] = await tx
      .select({ id: workflowVersions.id })
      .from(workflowVersions)
      .where(
        and(
          eq(workflowVersions.workflowId, workflowId),
          eq(workflowVersions.state, 'published'),
        ),
      )
      .orderBy(desc(workflowVersions.versionNumber))
      .limit(1);

    return version;
  }

  private async findEventBySourceId(
    tx: Database,
    endpointId: string,
    sourceEventId: string,
  ) {
    const [event] = await tx
      .select({
        id: incomingEvents.id,
        payloadSha256: incomingEvents.payloadSha256,
      })
      .from(incomingEvents)
      .where(
        and(
          eq(incomingEvents.webhookEndpointId, endpointId),
          eq(incomingEvents.sourceEventId, sourceEventId),
        ),
      )
      .limit(1);

    return event;
  }

  private async findExecutionByEventId(tx: Database, eventId: string) {
    const [execution] = await tx
      .select({
        id: executions.id,
        status: executions.status,
        workflowVersionId: executions.workflowVersionId,
        runSequence: executions.runSequence,
      })
      .from(executions)
      .where(
        and(
          eq(executions.incomingEventId, eventId),
          isNull(executions.replayedFromExecutionId),
        ),
      )
      .limit(1);

    return execution;
  }
}
