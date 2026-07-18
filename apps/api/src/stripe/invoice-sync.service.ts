import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type Stripe from 'stripe';
import { eq } from 'drizzle-orm';
import { DATABASE } from 'src/database/database.tokens';
import type { Database } from 'src/database/database.types';
import { invoices, stripeCustomers } from 'src/database/schema';

@Injectable()
export class InvoiceSyncService {
  constructor(
    @Inject(DATABASE)
    private readonly db: Database,
  ) {}

  async syncInvoice(invoice: Stripe.Invoice): Promise<void> {
    const stripeCustomerId = this.getCustomerId(invoice);

    if (!stripeCustomerId) {
      throw new ConflictException(
        `Stripe invoice ${invoice.id} has no customer`,
      );
    }

    if (!invoice.status) {
      throw new ConflictException(`Stripe invoice ${invoice.id} has no status`);
    }

    const [stripeCustomer] = await this.db
      .select({
        userId: stripeCustomers.userId,
      })
      .from(stripeCustomers)
      .where(eq(stripeCustomers.stripeCustomerId, stripeCustomerId))
      .limit(1);

    if (!stripeCustomer) {
      throw new NotFoundException(
        `Local Stripe customer ${stripeCustomerId} was not found`,
      );
    }

    const stripeSubscriptionId = this.getSubscriptionId(invoice);
    const updatedAt = new Date();

    const values = {
      userId: stripeCustomer.userId,
      stripeInvoiceId: invoice.id,
      stripeCustomerId,
      stripeSubscriptionId,
      invoiceNumber: invoice.number,
      status: invoice.status,
      currency: invoice.currency,
      amountDue: invoice.amount_due,
      amountPaid: invoice.amount_paid,
      hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
      invoicePdf: invoice.invoice_pdf ?? null,
      periodStart: this.fromStripeTimestamp(invoice.period_start),
      periodEnd: this.fromStripeTimestamp(invoice.period_end),
      stripeCreatedAt: this.fromStripeTimestamp(invoice.created),
      updatedAt,
    };

    await this.db
      .insert(invoices)
      .values(values)
      .onConflictDoUpdate({
        target: invoices.stripeInvoiceId,
        set: {
          userId: values.userId,
          stripeCustomerId: values.stripeCustomerId,
          stripeSubscriptionId: values.stripeSubscriptionId,
          invoiceNumber: values.invoiceNumber,
          status: values.status,
          currency: values.currency,
          amountDue: values.amountDue,
          amountPaid: values.amountPaid,
          hostedInvoiceUrl: values.hostedInvoiceUrl,
          invoicePdf: values.invoicePdf,
          periodStart: values.periodStart,
          periodEnd: values.periodEnd,
          stripeCreatedAt: values.stripeCreatedAt,
          updatedAt: values.updatedAt,
        },
      });
  }

  private getCustomerId(invoice: Stripe.Invoice): string | null {
    if (!invoice.customer) {
      return null;
    }

    return typeof invoice.customer === 'string'
      ? invoice.customer
      : invoice.customer.id;
  }

  private getSubscriptionId(invoice: Stripe.Invoice): string | null {
    const subscription = invoice.parent?.subscription_details?.subscription;

    if (!subscription) {
      return null;
    }

    return typeof subscription === 'string' ? subscription : subscription.id;
  }

  private fromStripeTimestamp(value: number): Date {
    return new Date(value * 1000);
  }
}
