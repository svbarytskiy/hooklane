import { Inject, Injectable } from '@nestjs/common';
import { desc, eq, and, inArray } from 'drizzle-orm';
import { DATABASE } from 'src/database/database.tokens';
import type { Database } from 'src/database/database.types';
import { subscriptions } from 'src/database/schema';

const CURRENT_SUBSCRIPTION_STATUSES = [
  'incomplete',
  'trialing',
  'active',
  'past_due',
  'unpaid',
  'paused',
];

@Injectable()
export class SubscriptionService {
  constructor(
    @Inject(DATABASE)
    private readonly db: Database,
  ) {}

  async findCurrentSubscription(userId: string) {
    const [subscription] = await this.db
      .select({
        id: subscriptions.id,
        stripeSubscriptionId: subscriptions.stripeSubscriptionId,
        stripePriceId: subscriptions.stripePriceId,
        status: subscriptions.status,
        currentPeriodStart: subscriptions.currentPeriodStart,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
        cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
        trialEnd: subscriptions.trialEnd,
        canceledAt: subscriptions.canceledAt,
      })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.userId, userId),
          inArray(subscriptions.status, CURRENT_SUBSCRIPTION_STATUSES),
        ),
      )
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);

    return subscription ?? null;
  }
}
