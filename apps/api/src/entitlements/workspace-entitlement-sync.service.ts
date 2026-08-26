import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DATABASE } from 'src/database/database.tokens';
import type { Database } from 'src/database/database.types';
import {
  billingCatalog,
  billingPlans,
  workspaceBillingAccounts,
  workspaceEntitlements,
} from 'src/database/schema';

type StripeSubscriptionProjection = {
  workspaceId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripePriceId: string;
  billingPlanId: string;
  status: 'active' | 'grace' | 'suspended';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  graceEndsAt: Date | null;
};

@Injectable()
export class WorkspaceEntitlementSyncService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async linkStripeCustomer(
    workspaceId: string,
    billingOwnerUserId: string,
    stripeCustomerId: string,
  ): Promise<void> {
    const updated = await this.db
      .update(workspaceBillingAccounts)
      .set({ stripeCustomerId, updatedAt: new Date() })
      .where(
        and(
          eq(workspaceBillingAccounts.workspaceId, workspaceId),
          eq(workspaceBillingAccounts.billingOwnerUserId, billingOwnerUserId),
        ),
      )
      .returning({ workspaceId: workspaceBillingAccounts.workspaceId });

    if (updated.length !== 1) {
      throw new NotFoundException('Workspace billing account was not found');
    }
  }

  async getBillingContext(workspaceId: string): Promise<{
    billingOwnerUserId: string;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    status: string;
  }> {
    const [context] = await this.db
      .select({
        billingOwnerUserId: workspaceBillingAccounts.billingOwnerUserId,
        stripeCustomerId: workspaceBillingAccounts.stripeCustomerId,
        stripeSubscriptionId: workspaceEntitlements.stripeSubscriptionId,
        status: workspaceEntitlements.status,
      })
      .from(workspaceBillingAccounts)
      .innerJoin(
        workspaceEntitlements,
        eq(
          workspaceEntitlements.workspaceId,
          workspaceBillingAccounts.workspaceId,
        ),
      )
      .where(eq(workspaceBillingAccounts.workspaceId, workspaceId))
      .limit(1);

    if (!context) {
      throw new NotFoundException('Workspace billing account was not found');
    }

    return context;
  }

  async applyStripeSubscription(
    projection: StripeSubscriptionProjection,
  ): Promise<void> {
    const [account] = await this.db
      .select({ stripeCustomerId: workspaceBillingAccounts.stripeCustomerId })
      .from(workspaceBillingAccounts)
      .where(eq(workspaceBillingAccounts.workspaceId, projection.workspaceId))
      .limit(1);
    if (!account || account.stripeCustomerId !== projection.stripeCustomerId) {
      throw new ConflictException(
        'Stripe customer does not match the workspace billing account',
      );
    }

    const [catalogEntry] = await this.db
      .select({ id: billingCatalog.id })
      .from(billingCatalog)
      .where(
        and(
          eq(billingCatalog.stripePriceId, projection.stripePriceId),
          eq(billingCatalog.billingPlanId, projection.billingPlanId),
          eq(billingCatalog.type, 'subscription'),
        ),
      )
      .limit(1);
    if (!catalogEntry) {
      throw new ConflictException(
        'Stripe subscription price does not map to its billing plan',
      );
    }

    const [plan] = await this.db
      .select({ id: billingPlans.id })
      .from(billingPlans)
      .where(eq(billingPlans.id, projection.billingPlanId))
      .limit(1);
    if (!plan) throw new NotFoundException('Billing plan was not found');

    const updated = await this.db
      .update(workspaceEntitlements)
      .set({
        billingPlanId: projection.billingPlanId,
        source: 'stripe_subscription',
        status: projection.status,
        stripeSubscriptionId: projection.stripeSubscriptionId,
        currentPeriodStart: projection.currentPeriodStart,
        currentPeriodEnd: projection.currentPeriodEnd,
        graceEndsAt: projection.graceEndsAt,
        updatedAt: new Date(),
      })
      .where(eq(workspaceEntitlements.workspaceId, projection.workspaceId))
      .returning({ workspaceId: workspaceEntitlements.workspaceId });

    if (updated.length !== 1) {
      throw new NotFoundException('Workspace entitlement was not found');
    }
  }

  async revertExpiredStripeSubscription(
    workspaceId: string,
    stripeSubscriptionId: string,
  ): Promise<void> {
    const [freePlan] = await this.db
      .select({ id: billingPlans.id })
      .from(billingPlans)
      .where(and(eq(billingPlans.code, 'free'), eq(billingPlans.version, 1)))
      .limit(1);
    if (!freePlan)
      throw new NotFoundException('Free billing plan was not found');

    await this.db
      .update(workspaceEntitlements)
      .set({
        billingPlanId: freePlan.id,
        source: 'free',
        status: 'active',
        stripeSubscriptionId: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        graceEndsAt: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(workspaceEntitlements.workspaceId, workspaceId),
          eq(workspaceEntitlements.stripeSubscriptionId, stripeSubscriptionId),
        ),
      );
  }
}
