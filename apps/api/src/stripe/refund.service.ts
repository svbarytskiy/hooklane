import {
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type Stripe from 'stripe';
import { and, eq, desc, sql } from 'drizzle-orm';
import { DATABASE } from 'src/database/database.tokens';
import type { Database } from 'src/database/database.types';
import {
  creditTransactions,
  invoices,
  payments,
  refunds,
} from 'src/database/schema';
import { STRIPE_CLIENT } from './stripe.tokens';
import type { StripeClient } from './stripe.types';
import type {
  AdminRefundsResponse,
  CreateRefundResponse,
} from '@billing-lab/contracts';

type PaymentRefundSource = {
  type: 'payment';
  id: string;
  userId: string;
};

type InvoiceRefundSource = {
  type: 'invoice';
  id: string;
  userId: string;
};

type RefundSource = PaymentRefundSource | InvoiceRefundSource;

const SUPPORTED_REFUND_STATUSES = new Set([
  'pending',
  'requires_action',
  'succeeded',
  'failed',
  'canceled',
]);

@Injectable()
export class RefundService {
  constructor(
    @Inject(DATABASE)
    private readonly db: Database,

    @Inject(STRIPE_CLIENT)
    private readonly stripe: StripeClient,
  ) {}

  async syncRefund(refund: Stripe.Refund): Promise<void> {
    const status = refund.status;

    if (!status || !SUPPORTED_REFUND_STATUSES.has(status)) {
      throw new ConflictException(
        `Stripe refund ${refund.id} has unsupported status`,
      );
    }

    const stripePaymentIntentId = await this.resolvePaymentIntentId(refund);

    if (!stripePaymentIntentId) {
      throw new ConflictException(
        `Stripe refund ${refund.id} has no PaymentIntent`,
      );
    }

    const source = await this.resolveRefundSource(stripePaymentIntentId);

    const stripeChargeId = refund.charge
      ? this.getStripeResourceId(refund.charge)
      : null;

    await this.db.transaction(async (tx) => {
      const payment =
        source.type === 'payment'
          ? await this.lockPayment(tx, source.id)
          : null;

      const values = {
        userId: source.userId,
        paymentId: source.type === 'payment' ? source.id : null,
        invoiceId: source.type === 'invoice' ? source.id : null,
        stripeRefundId: refund.id,
        stripeChargeId,
        stripePaymentIntentId,
        amount: refund.amount,
        currency: refund.currency,
        status,
        reason: refund.reason,
        failureReason: refund.failure_reason ?? null,
        stripeCreatedAt: new Date(refund.created * 1000),
        updatedAt: new Date(),
      };

      const [storedRefund] = await tx
        .insert(refunds)
        .values(values)
        .onConflictDoUpdate({
          target: refunds.stripeRefundId,
          set: {
            paymentId: values.paymentId,
            invoiceId: values.invoiceId,
            status: values.status,
            reason: values.reason,
            failureReason: values.failureReason,
            updatedAt: values.updatedAt,
          },
        })
        .returning({
          id: refunds.id,
        });

      if (!storedRefund) {
        throw new InternalServerErrorException(
          `Refund ${refund.id} was not stored`,
        );
      }

      if (status === 'succeeded' && payment) {
        await this.reconcileRefundedCredits(
          tx,
          payment,
          storedRefund.id,
          refund.id,
        );
      }
    });
  }

  private async resolvePaymentIntentId(
    refund: Stripe.Refund,
  ): Promise<string | null> {
    if (refund.payment_intent) {
      return this.getStripeResourceId(refund.payment_intent);
    }

    if (!refund.charge) {
      return null;
    }

    const charge =
      typeof refund.charge === 'string'
        ? await this.stripe.charges.retrieve(refund.charge)
        : refund.charge;

    return charge.payment_intent
      ? this.getStripeResourceId(charge.payment_intent)
      : null;
  }

  private async resolveRefundSource(
    stripePaymentIntentId: string,
  ): Promise<RefundSource> {
    const [payment] = await this.db
      .select({
        id: payments.id,
        userId: payments.userId,
      })
      .from(payments)
      .where(eq(payments.stripePaymentIntentId, stripePaymentIntentId))
      .limit(1);

    if (payment) {
      return {
        type: 'payment',
        ...payment,
      };
    }

    const invoicePayments = await this.stripe.invoicePayments.list({
      payment: {
        type: 'payment_intent',
        payment_intent: stripePaymentIntentId,
      },
      limit: 1,
    });

    const stripeInvoice = invoicePayments.data[0]?.invoice;

    if (!stripeInvoice) {
      throw new NotFoundException(
        `No invoice found for PaymentIntent ${stripePaymentIntentId}`,
      );
    }

    const stripeInvoiceId = this.getStripeResourceId(stripeInvoice);

    const [invoice] = await this.db
      .select({
        id: invoices.id,
        userId: invoices.userId,
      })
      .from(invoices)
      .where(eq(invoices.stripeInvoiceId, stripeInvoiceId))
      .limit(1);

    if (!invoice) {
      throw new NotFoundException(
        `Local invoice ${stripeInvoiceId} was not found`,
      );
    }

    return {
      type: 'invoice',
      ...invoice,
    };
  }

  private async lockPayment(
    tx: Parameters<Parameters<Database['transaction']>[0]>[0],
    paymentId: string,
  ) {
    const [payment] = await tx
      .select({
        id: payments.id,
        userId: payments.userId,
        amount: payments.amount,
        creditsAmount: payments.creditsAmount,
      })
      .from(payments)
      .where(eq(payments.id, paymentId))
      .for('update')
      .limit(1);

    if (!payment) {
      throw new NotFoundException(`Payment ${paymentId} was not found`);
    }

    return payment;
  }

  private async reconcileRefundedCredits(
    tx: Parameters<Parameters<Database['transaction']>[0]>[0],
    payment: {
      id: string;
      userId: string;
      amount: number;
      creditsAmount: number;
    },
    refundId: string,
    stripeRefundId: string,
  ): Promise<void> {
    const [refundTotal] = await tx
      .select({
        amount: sql<number>`
          coalesce(sum(${refunds.amount}), 0)::int
        `,
      })
      .from(refunds)
      .where(
        and(eq(refunds.paymentId, payment.id), eq(refunds.status, 'succeeded')),
      );

    const [creditTotal] = await tx
      .select({
        amount: sql<number>`
          coalesce(sum(${creditTransactions.amount}), 0)::int
        `,
      })
      .from(creditTransactions)
      .where(
        and(
          eq(creditTransactions.paymentId, payment.id),
          eq(creditTransactions.type, 'refund'),
        ),
      );

    const targetCredits = Math.min(
      payment.creditsAmount,
      Math.floor(
        (payment.creditsAmount * (refundTotal?.amount ?? 0)) / payment.amount,
      ),
    );

    const alreadyRefundedCredits = -(creditTotal?.amount ?? 0);
    const missingCredits = targetCredits - alreadyRefundedCredits;

    if (missingCredits <= 0) {
      return;
    }

    const [existingTransaction] = await tx
      .select({
        id: creditTransactions.id,
      })
      .from(creditTransactions)
      .where(eq(creditTransactions.refundId, refundId))
      .limit(1);

    await tx.insert(creditTransactions).values({
      userId: payment.userId,
      paymentId: payment.id,
      refundId: existingTransaction ? null : refundId,
      amount: -missingCredits,
      type: 'refund',
      description: `Stripe refund ${stripeRefundId}`,
    });
  }

  async createPaymentRefund(
    paymentId: string,
    amount: number | undefined,
    idempotencyKey: string | undefined,
  ): Promise<CreateRefundResponse> {
    if (!idempotencyKey?.trim()) {
      throw new ConflictException('Idempotency-Key header is required');
    }

    const [payment] = await this.db
      .select({
        id: payments.id,
        amount: payments.amount,
        status: payments.status,
        stripePaymentIntentId: payments.stripePaymentIntentId,
      })
      .from(payments)
      .where(eq(payments.id, paymentId))
      .limit(1);

    if (!payment) {
      throw new NotFoundException(`Payment ${paymentId} was not found`);
    }

    if (payment.status !== 'paid') {
      throw new ConflictException(`Payment ${paymentId} is not paid`);
    }

    if (!payment.stripePaymentIntentId) {
      throw new ConflictException(`Payment ${paymentId} has no PaymentIntent`);
    }

    if (amount !== undefined && amount > payment.amount) {
      throw new ConflictException('Refund amount exceeds payment amount');
    }

    const refund = await this.stripe.refunds.create(
      {
        payment_intent: payment.stripePaymentIntentId,
        amount,
        reason: 'requested_by_customer',
        metadata: {
          paymentId: payment.id,
        },
      },
      {
        idempotencyKey: `payment-refund:${payment.id}:${idempotencyKey}`,
      },
    );

    await this.syncRefund(refund);

    return {
      refundId: refund.id,
      amount: refund.amount,
      currency: refund.currency,
      status: refund.status,
    };
  }

  async getRefunds(): Promise<AdminRefundsResponse> {
    const refundRecords = await this.db
      .select({
        id: refunds.id,
        userId: refunds.userId,
        paymentId: refunds.paymentId,
        invoiceId: refunds.invoiceId,
        stripeRefundId: refunds.stripeRefundId,
        stripeChargeId: refunds.stripeChargeId,
        stripePaymentIntentId: refunds.stripePaymentIntentId,
        amount: refunds.amount,
        currency: refunds.currency,
        status: refunds.status,
        reason: refunds.reason,
        failureReason: refunds.failureReason,
        stripeCreatedAt: refunds.stripeCreatedAt,
        createdAt: refunds.createdAt,
        updatedAt: refunds.updatedAt,
      })
      .from(refunds)
      .orderBy(desc(refunds.createdAt))
      .limit(100);

    return {
      refunds: refundRecords.map((refund) => ({
        ...refund,
        stripeCreatedAt: refund.stripeCreatedAt.toISOString(),
        createdAt: refund.createdAt.toISOString(),
        updatedAt: refund.updatedAt.toISOString(),
      })),
    };
  }

  async createInvoiceRefund(
    invoiceId: string,
    amount: number | undefined,
    idempotencyKey: string | undefined,
  ): Promise<CreateRefundResponse> {
    if (!idempotencyKey?.trim()) {
      throw new ConflictException('Idempotency-Key header is required');
    }

    const [invoice] = await this.db
      .select({
        id: invoices.id,
        stripeInvoiceId: invoices.stripeInvoiceId,
        status: invoices.status,
        amountPaid: invoices.amountPaid,
      })
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1);

    if (!invoice) {
      throw new NotFoundException(`Invoice ${invoiceId} was not found`);
    }

    if (invoice.status !== 'paid' || invoice.amountPaid <= 0) {
      throw new ConflictException(`Invoice ${invoiceId} is not paid`);
    }

    if (amount !== undefined && amount > invoice.amountPaid) {
      throw new ConflictException('Refund amount exceeds invoice paid amount');
    }

    const invoicePayments = await this.stripe.invoicePayments.list({
      invoice: invoice.stripeInvoiceId,
      status: 'paid',
      limit: 2,
    });

    const paymentIntentPayments = invoicePayments.data.filter(
      (invoicePayment) =>
        invoicePayment.payment.type === 'payment_intent' &&
        Boolean(invoicePayment.payment.payment_intent),
    );

    if (paymentIntentPayments.length !== 1) {
      throw new ConflictException(
        `Invoice ${invoiceId} must have exactly one paid PaymentIntent`,
      );
    }

    const paymentIntent = paymentIntentPayments[0]?.payment.payment_intent;

    if (!paymentIntent) {
      throw new ConflictException(`Invoice ${invoiceId} has no PaymentIntent`);
    }

    const stripePaymentIntentId = this.getStripeResourceId(paymentIntent);

    const refund = await this.stripe.refunds.create(
      {
        payment_intent: stripePaymentIntentId,
        amount,
        reason: 'requested_by_customer',
        metadata: {
          invoiceId: invoice.id,
        },
      },
      {
        idempotencyKey: `invoice-refund:${invoice.id}:${idempotencyKey.trim()}`,
      },
    );

    await this.syncRefund(refund);

    return {
      refundId: refund.id,
      amount: refund.amount,
      currency: refund.currency,
      status: refund.status,
    };
  }

  private getStripeResourceId(resource: string | { id: string }): string {
    return typeof resource === 'string' ? resource : resource.id;
  }
}
