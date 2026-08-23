import {
  EXECUTION_NOTIFICATIONS_CHANNEL,
  type ExecutionNotificationType,
  type ExecutionNotificationV1,
} from '@hooklane/contracts';
import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { and, asc, eq, inArray, isNull, lt, lte, or, sql } from 'drizzle-orm';
import { DATABASE } from 'src/database/database.tokens';
import type { Database } from 'src/database/database.types';
import { executionNotificationOutbox } from 'src/database/schema';
import { RedisService } from 'src/redis/redis.service';

const POLL_INTERVAL_MS = 1_000;
const RETRY_DELAY_MS = 5_000;
const CLAIM_LEASE_MS = 60_000;
const BATCH_SIZE = 50;
const PUBLISHED_RETENTION_MS = 7 * 24 * 60 * 60 * 1_000;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1_000;
const CLEANUP_BATCH_SIZE = 1_000;

@Injectable()
export class ExecutionNotificationPublisher
  implements OnModuleInit, OnModuleDestroy
{
  private timer?: NodeJS.Timeout;
  private currentRun?: Promise<void>;
  private lastCleanupAt = 0;

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly redis: RedisService,
  ) {}

  onModuleInit(): void {
    void this.runOnce();
    this.timer = setInterval(() => void this.runOnce(), POLL_INTERVAL_MS);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.currentRun;
  }

  private runOnce(): Promise<void> {
    if (this.currentRun) return this.currentRun;
    this.currentRun = this.tick().finally(() => {
      this.currentRun = undefined;
    });
    return this.currentRun;
  }

  private async tick(): Promise<void> {
    try {
      await this.publishPending();
      await this.cleanupPublished();
    } catch (error) {
      console.error('[realtime] notification outbox poll failed', error);
    }
  }

  private async publishPending(): Promise<void> {
    const entries = await this.claimPending();

    for (const entry of entries) {
      const notification: ExecutionNotificationV1 = {
        version: 1,
        eventId: entry.id,
        type: entry.eventType as ExecutionNotificationType,
        sequence: entry.sequence,
        workspaceId: entry.workspaceId,
        workflowId: entry.workflowId,
        executionId: entry.executionId,
        occurredAt: entry.createdAt.toISOString(),
        data: entry.data as ExecutionNotificationV1['data'],
      };

      try {
        await this.redis.publish(
          EXECUTION_NOTIFICATIONS_CHANNEL,
          JSON.stringify(notification),
        );
        await this.db
          .update(executionNotificationOutbox)
          .set({
            status: 'published',
            publishedAt: new Date(),
            claimToken: null,
            claimExpiresAt: null,
            lastError: null,
          })
          .where(
            and(
              eq(executionNotificationOutbox.id, entry.id),
              eq(executionNotificationOutbox.status, 'processing'),
              eq(executionNotificationOutbox.claimToken, entry.claimToken),
            ),
          );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown publish error';
        await this.db
          .update(executionNotificationOutbox)
          .set({
            status: 'pending',
            attempts: sql`${executionNotificationOutbox.attempts} + 1`,
            lastError: message,
            nextAttemptAt: new Date(Date.now() + RETRY_DELAY_MS),
            claimToken: null,
            claimExpiresAt: null,
          })
          .where(
            and(
              eq(executionNotificationOutbox.id, entry.id),
              eq(executionNotificationOutbox.status, 'processing'),
              eq(executionNotificationOutbox.claimToken, entry.claimToken),
            ),
          );
      }
    }
  }

  private async claimPending() {
    const now = new Date();
    const claimExpiresAt = new Date(now.getTime() + CLAIM_LEASE_MS);
    const claimToken = crypto.randomUUID();

    return this.db.transaction(async (tx) => {
      const entries = await tx
        .select()
        .from(executionNotificationOutbox)
        .where(
          or(
            and(
              eq(executionNotificationOutbox.status, 'pending'),
              or(
                isNull(executionNotificationOutbox.nextAttemptAt),
                lte(executionNotificationOutbox.nextAttemptAt, now),
              ),
            ),
            and(
              eq(executionNotificationOutbox.status, 'processing'),
              lt(executionNotificationOutbox.claimExpiresAt, now),
            ),
          ),
        )
        .orderBy(asc(executionNotificationOutbox.createdAt))
        .for('update', { skipLocked: true })
        .limit(BATCH_SIZE);

      if (entries.length === 0) return [];

      await tx
        .update(executionNotificationOutbox)
        .set({
          status: 'processing',
          claimToken,
          claimExpiresAt,
        })
        .where(
          inArray(
            executionNotificationOutbox.id,
            entries.map((entry) => entry.id),
          ),
        );

      return entries.map((entry) => ({ ...entry, claimToken }));
    });
  }

  private async cleanupPublished(): Promise<void> {
    const now = Date.now();
    if (now - this.lastCleanupAt < CLEANUP_INTERVAL_MS) return;

    const cutoff = new Date(now - PUBLISHED_RETENTION_MS);
    await this.db.execute(sql`
      delete from execution_notification_outbox
      where id in (
        select id
        from execution_notification_outbox
        where status = 'published'
          and published_at < ${cutoff}
        order by published_at asc
        limit ${CLEANUP_BATCH_SIZE}
      )
    `);
    this.lastCleanupAt = now;
  }
}
