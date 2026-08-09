import type {
  ExecutionStatus,
  WebhookDeliveryHistoryItem,
} from '@hooklane/contracts';
import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, desc, eq } from 'drizzle-orm';
import type { Env } from 'src/config/env.schema';
import { DATABASE } from 'src/database/database.tokens';
import type { Database } from 'src/database/database.types';
import { executions, incomingEvents, workflows } from 'src/database/schema';

@Injectable()
export class WebhookDeliveryService {
  private readonly retentionDays: number;
  private readonly redactKeys: Set<string>;

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    config: ConfigService<Env, true>,
  ) {
    this.retentionDays = config.get('WEBHOOK_PAYLOAD_RETENTION_DAYS', {
      infer: true,
    });
    this.redactKeys = new Set(
      config
        .get('WEBHOOK_REDACT_KEYS', { infer: true })
        .split(',')
        .map((key) => key.trim().toLowerCase())
        .filter(Boolean),
    );
  }

  async listDeliveries(
    workspaceId: string,
    workflowId: string,
    requestedLimit?: string,
  ): Promise<WebhookDeliveryHistoryItem[]> {
    await this.assertWorkflowExists(workspaceId, workflowId);

    const limit = this.normalizeLimit(requestedLimit);
    const rows = await this.db
      .select({
        eventId: incomingEvents.id,
        executionId: executions.id,
        endpointId: incomingEvents.webhookEndpointId,
        sourceEventId: incomingEvents.sourceEventId,
        workflowVersionId: incomingEvents.workflowVersionId,
        eventStatus: incomingEvents.status,
        executionStatus: executions.status,
        payload: incomingEvents.payload,
        payloadSizeBytes: incomingEvents.payloadSizeBytes,
        receivedAt: incomingEvents.receivedAt,
        createdAt: executions.createdAt,
      })
      .from(incomingEvents)
      .innerJoin(executions, eq(executions.incomingEventId, incomingEvents.id))
      .where(
        and(
          eq(incomingEvents.workspaceId, workspaceId),
          eq(incomingEvents.workflowId, workflowId),
        ),
      )
      .orderBy(desc(incomingEvents.receivedAt))
      .limit(limit);

    return rows.map((row) => ({
      eventId: row.eventId,
      executionId: row.executionId,
      endpointId: row.endpointId,
      sourceEventId: row.sourceEventId,
      workflowVersionId: row.workflowVersionId,
      eventStatus: row.eventStatus as 'accepted',
      executionStatus: row.executionStatus as ExecutionStatus,
      payload: this.protectPayload(row.payload, row.receivedAt),
      payloadSizeBytes: row.payloadSizeBytes,
      receivedAt: row.receivedAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
    }));
  }

  private protectPayload(payload: unknown, receivedAt: Date): unknown {
    const retentionCutoff =
      Date.now() - this.retentionDays * 24 * 60 * 60 * 1000;

    if (receivedAt.getTime() < retentionCutoff) {
      return { _redacted: true, reason: 'retention_policy' };
    }

    return this.redactValue(payload);
  }

  private redactValue(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.redactValue(item));
    }

    if (!value || typeof value !== 'object') {
      return value;
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        this.redactKeys.has(key.toLowerCase())
          ? '[REDACTED]'
          : this.redactValue(child),
      ]),
    );
  }

  private async assertWorkflowExists(
    workspaceId: string,
    workflowId: string,
  ): Promise<void> {
    const [workflow] = await this.db
      .select({ id: workflows.id })
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
  }

  private normalizeLimit(value?: string): number {
    const parsed = value ? Number(value) : 50;

    if (!Number.isInteger(parsed) || parsed < 1) {
      return 50;
    }

    return Math.min(parsed, 100);
  }
}
