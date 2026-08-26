import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq } from 'drizzle-orm';
import type { AuthenticatedUser } from '@hooklane/contracts';
import type { Env } from 'src/config/env.schema';
import { DATABASE } from 'src/database/database.tokens';
import type { Database } from 'src/database/database.types';
import { workspaceSubscriptionCheckoutAttempts } from 'src/database/schema';
import { STRIPE_CLIENT } from 'src/stripe/stripe.tokens';
import type { StripeClient } from 'src/stripe/stripe.types';
import { WorkspaceEntitlementSyncService } from 'src/entitlements/workspace-entitlement-sync.service';
import { BillingCatalogService } from './billing-catalog.service';
import { BillingService } from './billing.service';
import type { CreateSubscriptionCheckoutDto } from './dto/create-subscription-checkout.dto';

@Injectable()
export class WorkspaceSubscriptionCheckoutService {
  constructor(
    @Inject(STRIPE_CLIENT)
    private readonly stripe: StripeClient,
    private readonly billingService: BillingService,
    private readonly catalog: BillingCatalogService,
    private readonly entitlementSync: WorkspaceEntitlementSyncService,
    private readonly config: ConfigService<Env, true>,
    @Inject(DATABASE) private readonly db: Database,
  ) {}

  async createCheckout(
    user: AuthenticatedUser,
    workspaceId: string,
    dto: CreateSubscriptionCheckoutDto,
    idempotencyKey: string | undefined,
  ): Promise<{ checkoutUrl: string }> {
    const normalizedKey = idempotencyKey?.trim();
    if (!normalizedKey) {
      throw new BadRequestException('Idempotency-Key header is required');
    }
    if (normalizedKey.length > 100) {
      throw new BadRequestException('Idempotency-Key is too long');
    }

    const existingAttempt = await this.findAttempt(workspaceId, normalizedKey);
    if (existingAttempt?.checkoutUrl) {
      return { checkoutUrl: existingAttempt.checkoutUrl };
    }
    if (!existingAttempt) {
      await this.db
        .insert(workspaceSubscriptionCheckoutAttempts)
        .values({ workspaceId, idempotencyKey: normalizedKey })
        .onConflictDoNothing();
    }

    const context = await this.entitlementSync.getBillingContext(workspaceId);
    if (context.billingOwnerUserId !== user.id) {
      throw new ForbiddenException(
        'Only the workspace billing owner can checkout',
      );
    }
    if (context.stripeSubscriptionId && context.status !== 'suspended') {
      throw new ConflictException(
        'Workspace already has an active subscription',
      );
    }

    const product = await this.catalog.getActiveProductByCode(dto.productCode);
    if (product.type !== 'subscription' || !product.billingPlanId) {
      throw new BadRequestException(
        'Selected product does not grant a workspace plan',
      );
    }

    const price = await this.stripe.prices.retrieve(product.stripePriceId);
    if (!price.active || price.type !== 'recurring') {
      throw new BadRequestException(
        'Stripe price is not an active recurring price',
      );
    }

    const stripeCustomerId =
      context.stripeCustomerId ??
      (await this.billingService.getOrCreateStripeCustomerId(user));
    await this.entitlementSync.linkStripeCustomer(
      workspaceId,
      user.id,
      stripeCustomerId,
    );

    const webUrl = this.config.get('WEB_URL', { infer: true });
    const session = await this.stripe.checkout.sessions.create(
      {
        mode: 'subscription',
        customer: stripeCustomerId,
        allow_promotion_codes: true,
        line_items: [{ price: product.stripePriceId, quantity: 1 }],
        client_reference_id: workspaceId,
        metadata: {
          workspaceId,
          billingPlanId: product.billingPlanId,
          productCode: product.code,
        },
        subscription_data: {
          metadata: {
            workspaceId,
            billingPlanId: product.billingPlanId,
            productCode: product.code,
          },
        },
        success_url:
          `${webUrl}/billing/subscription/success` +
          '?session_id={CHECKOUT_SESSION_ID}',
        cancel_url: `${webUrl}/billing/subscription/cancel`,
      },
      {
        idempotencyKey: `workspace-subscription-checkout:${workspaceId}:${normalizedKey}`,
      },
    );

    if (!session.url) {
      throw new InternalServerErrorException(
        'Stripe Checkout Session has no URL',
      );
    }
    await this.db
      .update(workspaceSubscriptionCheckoutAttempts)
      .set({
        stripeCheckoutSessionId: session.id,
        checkoutUrl: session.url,
        status: 'open',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(workspaceSubscriptionCheckoutAttempts.workspaceId, workspaceId),
          eq(
            workspaceSubscriptionCheckoutAttempts.idempotencyKey,
            normalizedKey,
          ),
        ),
      );
    return { checkoutUrl: session.url };
  }

  private async findAttempt(workspaceId: string, idempotencyKey: string) {
    const [attempt] = await this.db
      .select({
        checkoutUrl: workspaceSubscriptionCheckoutAttempts.checkoutUrl,
      })
      .from(workspaceSubscriptionCheckoutAttempts)
      .where(
        and(
          eq(workspaceSubscriptionCheckoutAttempts.workspaceId, workspaceId),
          eq(
            workspaceSubscriptionCheckoutAttempts.idempotencyKey,
            idempotencyKey,
          ),
        ),
      )
      .limit(1);
    return attempt ?? null;
  }
}
