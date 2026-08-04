import type {
  BillingInvoicesResponse,
  BillingUpcomingInvoiceResponse,
} from '@hooklane/contracts';
import { STRIPE_CLIENT } from 'src/stripe/stripe.tokens';
import type { StripeClient } from 'src/stripe/stripe.types';
import { SubscriptionService } from './subscription.service';
import { Inject, Injectable } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { DATABASE } from 'src/database/database.tokens';
import type { Database } from 'src/database/database.types';
import { invoices } from 'src/database/schema';

@Injectable()
export class InvoiceService {
  constructor(
    @Inject(DATABASE)
    private readonly db: Database,

    @Inject(STRIPE_CLIENT)
    private readonly stripe: StripeClient,

    private readonly subscriptionService: SubscriptionService,
  ) {}

  async getInvoices(userId: string): Promise<BillingInvoicesResponse> {
    const invoiceRecords = await this.db
      .select({
        id: invoices.id,
        stripeInvoiceId: invoices.stripeInvoiceId,
        invoiceNumber: invoices.invoiceNumber,
        status: invoices.status,
        currency: invoices.currency,
        amountDue: invoices.amountDue,
        amountPaid: invoices.amountPaid,
        hostedInvoiceUrl: invoices.hostedInvoiceUrl,
        invoicePdf: invoices.invoicePdf,
        periodStart: invoices.periodStart,
        periodEnd: invoices.periodEnd,
      })
      .from(invoices)
      .where(eq(invoices.userId, userId))
      .orderBy(desc(invoices.periodEnd))
      .limit(50);

    return {
      invoices: invoiceRecords.map((invoice) => ({
        ...invoice,
        periodStart: invoice.periodStart.toISOString(),
        periodEnd: invoice.periodEnd.toISOString(),
      })),
    };
  }

  async getUpcomingInvoice(
    userId: string,
  ): Promise<BillingUpcomingInvoiceResponse> {
    const subscription =
      await this.subscriptionService.findCurrentSubscription(userId);

    if (!subscription) {
      return {
        invoice: null,
      };
    }

    try {
      const preview = await this.stripe.invoices.createPreview({
        subscription: subscription.stripeSubscriptionId,
      });

      return {
        invoice: {
          currency: preview.currency,
          subtotal: preview.subtotal,
          total: preview.total,
          amountDue: preview.amount_due,
          periodStart: new Date(preview.period_start * 1000).toISOString(),
          periodEnd: new Date(preview.period_end * 1000).toISOString(),
        },
      };
    } catch (error) {
      if (this.isNoUpcomingInvoiceError(error)) {
        return {
          invoice: null,
        };
      }

      throw error;
    }
  }
  private isNoUpcomingInvoiceError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'invoice_upcoming_none'
    );
  }
}
