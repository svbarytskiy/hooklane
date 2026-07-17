import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type Stripe from 'stripe';
import { and, eq } from 'drizzle-orm';
import { DATABASE } from 'src/database/database.tokens';
import type { Database } from 'src/database/database.types';
import { creditTransactions, payments } from 'src/database/schema';

@Injectable()
export class StripeWebhookProcessor {
  constructor(
    @Inject(DATABASE)
    private readonly db: Database,
  ) {}

  async process(event: Stripe.Event): Promise<'processed' | 'ignored'> {
    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutSessionCompleted(event);
        return 'processed';

      case 'payment_intent.payment_failed':
        await this.handlePaymentIntentFailed(event);
        return 'processed';

      case 'payment_intent.succeeded':
        await this.handlePaymentIntentSucceeded(event);
        return 'processed';

      case 'checkout.session.expired':
        await this.handleCheckoutSessionExpired(event);
        return 'processed';

      case 'checkout.session.async_payment_succeeded':
        await this.handleCheckoutSessionCompleted(event);
        return 'processed';

      case 'checkout.session.async_payment_failed':
        await this.handleCheckoutSessionAsyncFailed(event);
        return 'processed';
      default:
        return 'ignored';
    }
  }

  private async handleCheckoutSessionCompleted(
    event: Stripe.Event,
  ): Promise<void> {
    const session = event.data.object as Stripe.Checkout.Session;
    const paymentId = session.client_reference_id;

    if (!paymentId) {
      throw new ConflictException('Checkout Session has no payment reference');
    }

    await this.db.transaction(async (tx) => {
      const [payment] = await tx
        .select({
          id: payments.id,
          userId: payments.userId,
          creditsAmount: payments.creditsAmount,
          amount: payments.amount,
          currency: payments.currency,
          stripeCheckoutSessionId: payments.stripeCheckoutSessionId,
          status: payments.status,
        })
        .from(payments)
        .where(eq(payments.id, paymentId))
        .limit(1);

      if (!payment) {
        throw new NotFoundException('Payment ' + paymentId + ' was not found');
      }

      if (payment.status === 'paid') {
        return;
      }

      if (payment.status !== 'pending') {
        throw new ConflictException(
          'Payment ' + payment.id + ' has status ' + payment.status,
        );
      }

      if (session.id !== payment.stripeCheckoutSessionId) {
        throw new ConflictException('Checkout Session does not match payment');
      }

      if (session.payment_status !== 'paid') {
        throw new ConflictException('Checkout Session payment is not paid');
      }

      if (
        session.amount_total !== payment.amount ||
        session.currency?.toLowerCase() !== payment.currency.toLowerCase()
      ) {
        throw new ConflictException(
          'Stripe payment amount or currency does not match payment',
        );
      }

      const [updatedPayment] = await tx
        .update(payments)
        .set({
          status: 'paid',
          stripePaymentIntentId: this.getPaymentIntentId(session),
          updatedAt: new Date(),
        })
        .where(and(eq(payments.id, payment.id), eq(payments.status, 'pending')))
        .returning({
          id: payments.id,
        });

      if (!updatedPayment) {
        throw new ConflictException('Payment was changed before fulfillment');
      }
      await tx.insert(creditTransactions).values({
        userId: payment.userId,
        paymentId: payment.id,
        amount: payment.creditsAmount,
        type: 'purchase',
        description: 'Credits purchased through Stripe Checkout',
      });
    });
  }

  private async handlePaymentIntentFailed(event: Stripe.Event): Promise<void> {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const paymentId = paymentIntent.metadata.paymentId;

    if (!paymentId) {
      throw new ConflictException('PaymentIntent has no payment reference');
    }

    const [updatedPayment] = await this.db
      .update(payments)
      .set({
        stripePaymentIntentId: paymentIntent.id,
        updatedAt: new Date(),
      })
      .where(eq(payments.id, paymentId))
      .returning({
        id: payments.id,
      });

    if (!updatedPayment) {
      throw new NotFoundException('Payment ' + paymentId + ' was not found');
    }
  }

  private async handlePaymentIntentSucceeded(
    event: Stripe.Event,
  ): Promise<void> {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const paymentId = paymentIntent.metadata.paymentId;

    if (!paymentId) {
      throw new ConflictException('PaymentIntent has no payment reference');
    }

    const [updatedPayment] = await this.db
      .update(payments)
      .set({
        stripePaymentIntentId: paymentIntent.id,
        updatedAt: new Date(),
      })
      .where(eq(payments.id, paymentId))
      .returning({
        id: payments.id,
      });

    if (!updatedPayment) {
      throw new NotFoundException('Payment ' + paymentId + ' was not found');
    }
  }

  private async handleCheckoutSessionAsyncFailed(
    event: Stripe.Event,
  ): Promise<void> {
    const session = event.data.object as Stripe.Checkout.Session;
    const paymentId = session.client_reference_id;

    if (!paymentId) {
      throw new ConflictException(
        'Async failed Checkout Session has no payment reference',
      );
    }

    const [updatedPayment] = await this.db
      .update(payments)
      .set({
        status: 'failed',
        updatedAt: new Date(),
      })
      .where(and(eq(payments.id, paymentId), eq(payments.status, 'pending')))
      .returning({
        id: payments.id,
      });

    if (updatedPayment) {
      return;
    }

    const [existingPayment] = await this.db
      .select({
        id: payments.id,
        status: payments.status,
      })
      .from(payments)
      .where(eq(payments.id, paymentId))
      .limit(1);

    if (!existingPayment) {
      throw new NotFoundException('Payment ' + paymentId + ' was not found');
    }

    if (
      existingPayment.status !== 'failed' &&
      existingPayment.status !== 'expired'
    ) {
      throw new ConflictException(
        'Payment ' + paymentId + ' has status ' + existingPayment.status,
      );
    }
  }
  private async handleCheckoutSessionExpired(
    event: Stripe.Event,
  ): Promise<void> {
    const session = event.data.object as Stripe.Checkout.Session;
    const paymentId = session.client_reference_id;

    if (!paymentId) {
      throw new ConflictException(
        'Expired Checkout Session has no payment reference',
      );
    }

    const [updatedPayment] = await this.db
      .update(payments)
      .set({
        status: 'expired',
        updatedAt: new Date(),
      })
      .where(and(eq(payments.id, paymentId), eq(payments.status, 'pending')))
      .returning({
        id: payments.id,
      });

    if (!updatedPayment) {
      const [existingPayment] = await this.db
        .select({
          id: payments.id,
          status: payments.status,
        })
        .from(payments)
        .where(eq(payments.id, paymentId))
        .limit(1);

      if (!existingPayment) {
        throw new NotFoundException('Payment ' + paymentId + ' was not found');
      }

      if (existingPayment.status !== 'expired') {
        throw new ConflictException(
          'Payment ' + paymentId + ' has status ' + existingPayment.status,
        );
      }
    }
  }

  private getPaymentIntentId(session: Stripe.Checkout.Session): string | null {
    if (!session.payment_intent) {
      return null;
    }

    return typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent.id;
  }
}
