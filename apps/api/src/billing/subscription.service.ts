import { Inject, Injectable } from '@nestjs/common';
import { desc, eq, and, inArray } from 'drizzle-orm';
import { DATABASE } from 'src/database/database.tokens';
import type { Database } from 'src/database/database.types';
import { subscriptions } from 'src/database/schema';
import type { BillingSubscriptionResponse } from '@hooklane/contracts';

const CURRENT_SUBSCRIPTION_STATUSES = [
  'incomplete',
  'trialing',
  'active',
  'past_due',
  'unpaid',
  'paused',
];

const PREMIUM_ACCESS_STATUSES = new Set(['trialing', 'active']);

const subscriptionSelection = {
  id: subscriptions.id,
  stripeSubscriptionId: subscriptions.stripeSubscriptionId,
  stripePriceId: subscriptions.stripePriceId,
  status: subscriptions.status,
  currentPeriodStart: subscriptions.currentPeriodStart,
  currentPeriodEnd: subscriptions.currentPeriodEnd,
  cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
  trialEnd: subscriptions.trialEnd,
  canceledAt: subscriptions.canceledAt,
};

@Injectable()
export class SubscriptionService {
  constructor(
    @Inject(DATABASE)
    private readonly db: Database,
  ) {}

  async findCurrentSubscription(userId: string) {
    const [subscription] = await this.db
      .select(subscriptionSelection)
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

  private async findLatestSubscription(userId: string) {
    const [subscription] = await this.db
      .select(subscriptionSelection)
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);

    return subscription ?? null;
  }

  async getSubscriptionState(
    userId: string,
  ): Promise<BillingSubscriptionResponse> {
    const subscription = await this.findLatestSubscription(userId);

    if (!subscription) {
      return {
        subscription: null,
      };
    }

    return {
      subscription: {
        id: subscription.id,
        stripeSubscriptionId: subscription.stripeSubscriptionId,
        stripePriceId: subscription.stripePriceId,
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart.toISOString(),
        currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        trialEnd: subscription.trialEnd?.toISOString() ?? null,
        canceledAt: subscription.canceledAt?.toISOString() ?? null,
      },
    };
  }

  async hasPremiumAccess(userId: string): Promise<boolean> {
    const subscription = await this.findCurrentSubscription(userId);

    if (!subscription) {
      return false;
    }

    return PREMIUM_ACCESS_STATUSES.has(subscription.status);
  }
}
