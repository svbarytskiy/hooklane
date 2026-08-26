import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { sql } from 'drizzle-orm';
import { Inject } from '@nestjs/common';
import { DATABASE } from 'src/database/database.tokens';
import type { Database } from 'src/database/database.types';
import { ScheduledTaskLockService } from './scheduled-task-lock.service';

const BATCH_SIZE = 250;

@Injectable()
export class ExecutionRetentionService {
  private readonly logger = new Logger(ExecutionRetentionService.name);

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly locks: ScheduledTaskLockService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async pruneExpiredExecutions(): Promise<void> {
    if (!(await this.locks.tryAcquire('execution-retention', 15 * 60))) return;
    let deleted = 0;

    do {
      const rows = await this.db.execute(sql`
        with expired as (
          select executions.id
          from public.executions executions
          join public.workspace_entitlements entitlements
            on entitlements.workspace_id = executions.workspace_id
          join public.billing_plans plans
            on plans.id = entitlements.billing_plan_id
          where executions.status in ('succeeded', 'failed', 'cancelled', 'dead_lettered')
            and executions.completed_at < now() - make_interval(days => plans.execution_retention_days)
          order by executions.completed_at asc
          limit ${BATCH_SIZE}
          for update of executions skip locked
        )
        delete from public.executions
        where id in (select id from expired)
        returning id
      `);
      deleted += rows.length;
    } while (deleted % BATCH_SIZE === 0 && deleted > 0);

    if (deleted > 0) {
      this.logger.log(`Pruned ${deleted} expired executions`);
    }

    await this.db.execute(sql`
      delete from public.oauth_authorization_states
      where expires_at < now() - interval '1 day'
    `);
    await this.db.execute(sql`
      delete from public.workspace_subscription_checkout_attempts
      where status in ('completed', 'expired', 'failed')
        and updated_at < now() - interval '30 days'
    `);
  }
}
