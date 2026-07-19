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
import {
  creditTransactions,
  payments,
  stripeCustomers,
  subscriptions,
} from 'src/database/schema';
import { STRIPE_CLIENT } from './stripe.tokens';
import type { StripeClient } from './stripe.types';
import { InvoiceSyncService } from './invoice-sync.service';
import { RefundService } from './refund.service';

@Injectable()
export class StripeWebhookProcessor {
  constructor(
    @Inject(DATABASE)
    private readonly db: Database,

    @Inject(STRIPE_CLIENT)
    private readonly stripe: StripeClient,

    private readonly invoiceSyncService: InvoiceSyncService,
    private readonly refundService: RefundService,
  ) {}

  async process(event: Stripe.Event): Promise<'processed' | 'ignored'> {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object;

        if (!this.isCreditsCheckoutSession(session)) {
          return 'ignored';
        }

        await this.handleCheckoutSessionCompleted(event);
        return 'processed';
      }

      case 'checkout.session.async_payment_failed': {
        const session = event.data.object;

        if (!this.isCreditsCheckoutSession(session)) {
          return 'ignored';
        }

        await this.handleCheckoutSessionAsyncFailed(event);
        return 'processed';
      }

      case 'checkout.session.expired': {
        const session = event.data.object;

        if (!this.isCreditsCheckoutSession(session)) {
          return 'ignored';
        }

        await this.handleCheckoutSessionExpired(event);
        return 'processed';
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;

        if (!this.isCreditsPaymentIntent(paymentIntent)) {
          return 'ignored';
        }

        await this.handlePaymentIntentSucceeded(event);
        return 'processed';
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object;

        if (!this.isCreditsPaymentIntent(paymentIntent)) {
          return 'ignored';
        }

        await this.handlePaymentIntentFailed(event);
        return 'processed';
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        await this.handleSubscriptionChanged(event.data.object.id);
        return 'processed';
      }
      case 'invoice.created':
      case 'invoice.finalized':
      case 'invoice.updated':
      case 'invoice.voided':
      case 'invoice.marked_uncollectible': {
        await this.invoiceSyncService.syncInvoice(event.data.object);
        return 'processed';
      }

      case 'invoice.payment_succeeded':
      case 'invoice.payment_failed': {
        const invoice = event.data.object;

        await this.invoiceSyncService.syncInvoice(invoice);

        const stripeSubscriptionId = this.getInvoiceSubscriptionId(invoice);

        if (stripeSubscriptionId) {
          await this.handleSubscriptionChanged(stripeSubscriptionId);
        }

        return 'processed';
      }

      case 'refund.created':
      case 'refund.updated':
      case 'refund.failed': {
        await this.refundService.syncRefund(event.data.object);
        return 'processed';
      }
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

  private async handleSubscriptionChanged(
    stripeSubscriptionId: string,
  ): Promise<void> {
    const subscription =
      await this.stripe.subscriptions.retrieve(stripeSubscriptionId);

    const stripeCustomerId = this.getStripeResourceId(subscription.customer);

    const [customer] = await this.db
      .select({
        userId: stripeCustomers.userId,
      })
      .from(stripeCustomers)
      .where(eq(stripeCustomers.stripeCustomerId, stripeCustomerId))
      .limit(1);

    if (!customer) {
      throw new NotFoundException(
        `Stripe customer ${stripeCustomerId} is not linked to a user`,
      );
    }

    const metadataUserId = subscription.metadata.userId;

    if (metadataUserId && metadataUserId !== customer.userId) {
      throw new ConflictException(
        'Subscription metadata user does not match Stripe customer owner',
      );
    }

    if (subscription.items.data.length !== 1) {
      throw new ConflictException(
        'Expected subscription to contain exactly one item',
      );
    }

    const item = subscription.items.data[0];

    if (!item) {
      throw new ConflictException('Subscription item was not returned');
    }

    const values = {
      userId: customer.userId,
      stripeCustomerId,
      stripeSubscriptionId: subscription.id,
      stripeSubscriptionItemId: item.id,
      stripePriceId: item.price.id,
      status: subscription.status,
      currentPeriodStart: this.fromStripeTimestamp(item.current_period_start),
      currentPeriodEnd: this.fromStripeTimestamp(item.current_period_end),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      trialEnd: this.fromNullableStripeTimestamp(subscription.trial_end),
      canceledAt: this.fromNullableStripeTimestamp(subscription.canceled_at),
      updatedAt: new Date(),
    };

    await this.db
      .insert(subscriptions)
      .values(values)
      .onConflictDoUpdate({
        target: subscriptions.stripeSubscriptionId,
        set: {
          stripeCustomerId: values.stripeCustomerId,
          stripeSubscriptionItemId: values.stripeSubscriptionItemId,
          stripePriceId: values.stripePriceId,
          status: values.status,
          currentPeriodStart: values.currentPeriodStart,
          currentPeriodEnd: values.currentPeriodEnd,
          cancelAtPeriodEnd: values.cancelAtPeriodEnd,
          trialEnd: values.trialEnd,
          canceledAt: values.canceledAt,
          updatedAt: values.updatedAt,
        },
      });
  }

  private getPaymentIntentId(session: Stripe.Checkout.Session): string | null {
    if (!session.payment_intent) {
      return null;
    }

    return typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent.id;
  }

  private getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
    const subscription = invoice.parent?.subscription_details?.subscription;

    if (!subscription) {
      return null;
    }

    return this.getStripeResourceId(subscription);
  }

  private isCreditsCheckoutSession(session: Stripe.Checkout.Session): boolean {
    return session.mode === 'payment' && Boolean(session.metadata?.paymentId);
  }

  private isCreditsPaymentIntent(paymentIntent: Stripe.PaymentIntent): boolean {
    return Boolean(paymentIntent.metadata.paymentId);
  }

  private fromStripeTimestamp(value: number): Date {
    return new Date(value * 1000);
  }

  private fromNullableStripeTimestamp(value: number | null): Date | null {
    return value === null ? null : this.fromStripeTimestamp(value);
  }

  private getStripeResourceId(resource: string | { id: string }): string {
    return typeof resource === 'string' ? resource : resource.id;
  }
}
