import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { isNotNull } from 'drizzle-orm';
import { DATABASE } from 'src/database/database.tokens';
import type { Database } from 'src/database/database.types';
import { workspaceEntitlements } from 'src/database/schema';
import { StripeWebhookProcessor } from './stripe-webhook-processor.service';
import { ScheduledTaskLockService } from 'src/entitlements/scheduled-task-lock.service';

@Injectable()
export class StripeEntitlementReconciliationService {
  private readonly logger = new Logger(
    StripeEntitlementReconciliationService.name,
  );

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly processor: StripeWebhookProcessor,
    private readonly locks: ScheduledTaskLockService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async reconcile(): Promise<void> {
    if (
      !(await this.locks.tryAcquire(
        'stripe-entitlement-reconciliation',
        30 * 60,
      ))
    ) {
      return;
    }
    const subscriptions = await this.db
      .select({
        stripeSubscriptionId: workspaceEntitlements.stripeSubscriptionId,
      })
      .from(workspaceEntitlements)
      .where(isNotNull(workspaceEntitlements.stripeSubscriptionId));

    for (const subscription of subscriptions) {
      try {
        await this.processor.reconcileSubscription(
          subscription.stripeSubscriptionId!,
        );
      } catch (error) {
        this.logger.error(
          `Failed to reconcile Stripe subscription ${subscription.stripeSubscriptionId}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
  }
}
