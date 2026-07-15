import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq } from 'drizzle-orm';
import type {
  AuthenticatedUser,
  CreateCheckoutResponse,
} from '@billing-lab/contracts';
import { DATABASE } from 'src/database/database.tokens';
import type { Database } from 'src/database/database.types';
import { payments } from 'src/database/schema';
import type { Env } from 'src/config/env.schema';
import { STRIPE_CLIENT } from 'src/stripe/stripe.tokens';
import type { StripeClient } from 'src/stripe/stripe.types';
import { BillingCatalogService } from './billing-catalog.service';
import { BillingService } from './billing.service';
import type { CreateCreditsCheckoutDto } from './dto/create-credits-checkout.dto';

type StripeCheckoutSession = Awaited<
  ReturnType<StripeClient['checkout']['sessions']['create']>
>;

@Injectable()
export class CheckoutService {
  constructor(
    @Inject(DATABASE)
    private readonly db: Database,

    @Inject(STRIPE_CLIENT)
    private readonly stripe: StripeClient,

    private readonly billingService: BillingService,

    private readonly billingCatalogService: BillingCatalogService,

    private readonly config: ConfigService<Env, true>,
  ) {}

  async createCreditsCheckout(
    user: AuthenticatedUser,
    dto: CreateCreditsCheckoutDto,
    idempotencyKey: string | undefined,
  ): Promise<CreateCheckoutResponse> {
    if (!idempotencyKey?.trim()) {
      throw new BadRequestException('Idempotency-Key header is required');
    }

    const product = await this.billingCatalogService.getActiveProductByCode(
      dto.productCode,
    );

    if (product.type !== 'one_time') {
      throw new BadRequestException('Selected product is not a one-time price');
    }

    if (product.creditsAmount === null) {
      throw new BadRequestException('Selected product has no credits amount');
    }

    const price = await this.stripe.prices.retrieve(product.stripePriceId);

    if (price.type !== 'one_time' || price.unit_amount === null) {
      throw new BadRequestException(
        'Stripe Price is not a fixed one-time price',
      );
    }

    const stripeCustomerId =
      await this.billingService.getOrCreateStripeCustomerId(user);

    let payment = await this.findPayment(user.id, idempotencyKey);

    if (payment?.stripeCheckoutSessionId) {
      const session = await this.stripe.checkout.sessions.retrieve(
        payment.stripeCheckoutSessionId,
      );

      if (!session.url) {
        throw new InternalServerErrorException(
          'Existing Checkout Session has no URL',
        );
      }

      return {
        paymentId: payment.id,
        checkoutUrl: session.url,
      };
    }

    if (!payment) {
      try {
        [payment] = await this.db
          .insert(payments)
          .values({
            userId: user.id,
            stripeCustomerId,
            checkoutIdempotencyKey: idempotencyKey,
            productType: product.code,
            amount: price.unit_amount,
            currency: price.currency,
            creditsAmount: product.creditsAmount,
            status: 'pending',
          })
          .returning({
            id: payments.id,
            stripeCheckoutSessionId: payments.stripeCheckoutSessionId,
          });
      } catch (error) {
        if (!this.isUniqueViolation(error)) {
          throw error;
        }

        payment = await this.findPayment(user.id, idempotencyKey);
      }
    }

    if (!payment) {
      throw new ConflictException('Checkout payment could not be created');
    }

    const webUrl = this.config.get('WEB_URL', {
      infer: true,
    });

    let session: StripeCheckoutSession;

    try {
      session = await this.stripe.checkout.sessions.create(
        {
          mode: 'payment',
          customer: stripeCustomerId,
          line_items: [
            {
              price: product.stripePriceId,
              quantity: 1,
            },
          ],
          client_reference_id: payment.id,
          metadata: {
            userId: user.id,
            paymentId: payment.id,
            productCode: product.code,
          },
          payment_intent_data: {
            metadata: {
              userId: user.id,
              paymentId: payment.id,
              productCode: product.code,
            },
          },
          success_url: `${webUrl}/billing/success?payment_id=${payment.id}`,
          cancel_url: `${webUrl}/billing/cancel?payment_id=${payment.id}`,
        },
        {
          idempotencyKey: `checkout-session:${payment.id}`,
        },
      );
    } catch (error) {
      await this.db
        .update(payments)
        .set({
          status: 'failed',
          updatedAt: new Date(),
        })
        .where(eq(payments.id, payment.id));

      throw error;
    }

    if (!session.url) {
      throw new InternalServerErrorException(
        'Stripe Checkout Session has no URL',
      );
    }

    await this.db
      .update(payments)
      .set({
        stripeCheckoutSessionId: session.id,
        updatedAt: new Date(),
      })
      .where(eq(payments.id, payment.id));

    return {
      paymentId: payment.id,
      checkoutUrl: session.url,
    };
  }

  private async findPayment(userId: string, idempotencyKey: string) {
    const [payment] = await this.db
      .select({
        id: payments.id,
        stripeCheckoutSessionId: payments.stripeCheckoutSessionId,
      })
      .from(payments)
      .where(
        and(
          eq(payments.userId, userId),
          eq(payments.checkoutIdempotencyKey, idempotencyKey),
        ),
      )
      .limit(1);

    return payment ?? null;
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === '23505'
    );
  }
}
