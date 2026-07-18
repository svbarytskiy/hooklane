import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from 'src/config/env.schema';
import { STRIPE_CLIENT } from 'src/stripe/stripe.tokens';
import type { StripeClient } from 'src/stripe/stripe.types';
import { BillingCatalogService } from './billing-catalog.service';
import { BillingService } from './billing.service';
import { SubscriptionService } from './subscription.service';
import {
  AuthenticatedUser,
  CreateSubscriptionCheckoutResponse,
} from '@billing-lab/contracts';
import { CreateSubscriptionCheckoutDto } from './dto/create-subscription-checkout.dto';

@Injectable()
export class SubscriptionCheckoutService {
  constructor(
    @Inject(STRIPE_CLIENT)
    private readonly stripe: StripeClient,

    private readonly billingService: BillingService,
    private readonly billingCatalogService: BillingCatalogService,
    private readonly subscriptionService: SubscriptionService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async createSubscriptionCheckout(
    user: AuthenticatedUser,
    dto: CreateSubscriptionCheckoutDto,
    idempotencyKey: string | undefined,
  ): Promise<CreateSubscriptionCheckoutResponse> {
    const normalizedKey = idempotencyKey?.trim();

    if (!normalizedKey) {
      throw new BadRequestException('Idempotency-Key header is required');
    }

    if (normalizedKey.length > 100) {
      throw new BadRequestException('Idempotency-Key is too long');
    }

    const product = await this.billingCatalogService.getActiveProductByCode(
      dto.productCode,
    );

    if (product.type !== 'subscription') {
      throw new BadRequestException(
        'Selected product is not a subscription product',
      );
    }

    const price = await this.stripe.prices.retrieve(product.stripePriceId);

    if (!price.active || price.type !== 'recurring') {
      throw new BadRequestException(
        'Stripe price is not an active recurring price',
      );
    }

    const currentSubscription =
      await this.subscriptionService.findCurrentSubscription(user.id);

    if (currentSubscription) {
      throw new ConflictException(
        `User already has a subscription with status ${currentSubscription.status}`,
      );
    }

    const stripeCustomerId =
      await this.billingService.getOrCreateStripeCustomerId(user);

    const webUrl = this.config.get('WEB_URL', { infer: true });

    const session = await this.stripe.checkout.sessions.create(
      {
        mode: 'subscription',
        customer: stripeCustomerId,
        allow_promotion_codes: true,
        line_items: [
          {
            price: product.stripePriceId,
            quantity: 1,
          },
        ],
        client_reference_id: user.id,
        metadata: {
          userId: user.id,
          productCode: product.code,
        },
        subscription_data: {
          metadata: {
            userId: user.id,
            productCode: product.code,
          },
        },
        success_url:
          `${webUrl}/billing/subscription/success` +
          '?session_id={CHECKOUT_SESSION_ID}',
        cancel_url: `${webUrl}/billing/subscription/cancel`,
      },
      {
        idempotencyKey: `subscription-checkout:${user.id}:${normalizedKey}`,
      },
    );

    if (!session.url) {
      throw new InternalServerErrorException(
        'Stripe Checkout Session has no URL',
      );
    }

    return {
      checkoutUrl: session.url,
    };
  }
}
