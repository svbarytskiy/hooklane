import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { and, eq, isNull, lte, or, sql } from 'drizzle-orm';
import { DATABASE } from 'src/database/database.tokens';
import type { Database } from 'src/database/database.types';
import { executionOutbox, executions } from 'src/database/schema';
import { WorkflowExecutionProducer } from './workflow-execution.producer';

@Injectable()
export class OutboxReconcilerService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly producer: WorkflowExecutionProducer,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.reconcile(), 10_000);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async reconcile(): Promise<void> {
    if (this.running) return;
    this.running = true;

    try {
      const entries = await this.db
        .select({
          outboxId: executionOutbox.id,
          executionId: executions.id,
          incomingEventId: executions.incomingEventId,
          workflowVersionId: executions.workflowVersionId,
        })
        .from(executionOutbox)
        .innerJoin(executions, eq(executions.id, executionOutbox.executionId))
        .where(
          and(
            eq(executionOutbox.status, 'pending'),
            or(
              isNull(executionOutbox.nextAttemptAt),
              lte(executionOutbox.nextAttemptAt, new Date()),
            ),
          ),
        )
        .limit(25);

      for (const entry of entries) {
        try {
          await this.producer.enqueueExecution({
            executionId: entry.executionId,
            incomingEventId: entry.incomingEventId,
            workflowVersionId: entry.workflowVersionId,
          });
          await this.db
            .update(executions)
            .set({ status: 'queued', queuedAt: new Date() })
            .where(
              and(
                eq(executions.id, entry.executionId),
                eq(executions.status, 'pending'),
              ),
            );
          await this.db
            .update(executionOutbox)
            .set({ status: 'published', publishedAt: new Date() })
            .where(eq(executionOutbox.id, entry.outboxId));
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Unknown enqueue error';
          await this.db
            .update(executionOutbox)
            .set({
              attempts: sql`${executionOutbox.attempts} + 1`,
              lastError: message,
              nextAttemptAt: new Date(Date.now() + 10_000),
            })
            .where(eq(executionOutbox.id, entry.outboxId));
        }
      }
    } finally {
      this.running = false;
    }
  }
}
