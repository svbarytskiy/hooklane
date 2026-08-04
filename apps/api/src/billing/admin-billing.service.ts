import type {
  AdminInvoicesResponse,
  AdminPaymentsResponse,
} from '@hooklane/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { count, desc } from 'drizzle-orm';
import { DATABASE } from 'src/database/database.tokens';
import type { Database } from 'src/database/database.types';
import { invoices, payments } from 'src/database/schema';
import type { AdminListQueryDto } from './dto/admin-list-query.dto';

@Injectable()
export class AdminBillingService {
  constructor(
    @Inject(DATABASE)
    private readonly db: Database,
  ) {}

  async getPayments(query: AdminListQueryDto): Promise<AdminPaymentsResponse> {
    const offset = (query.page - 1) * query.limit;

    const [paymentRecords, [totalRecord]] = await Promise.all([
      this.db
        .select({
          id: payments.id,
          userId: payments.userId,
          productType: payments.productType,
          amount: payments.amount,
          currency: payments.currency,
          creditsAmount: payments.creditsAmount,
          status: payments.status,
          stripePaymentIntentId: payments.stripePaymentIntentId,
          createdAt: payments.createdAt,
        })
        .from(payments)
        .orderBy(desc(payments.createdAt))
        .limit(query.limit)
        .offset(offset),

      this.db.select({ total: count() }).from(payments),
    ]);

    const total = totalRecord?.total ?? 0;

    return {
      payments: paymentRecords.map((payment) => ({
        ...payment,
        createdAt: payment.createdAt.toISOString(),
      })),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async getInvoices(query: AdminListQueryDto): Promise<AdminInvoicesResponse> {
    const offset = (query.page - 1) * query.limit;

    const [invoiceRecords, [totalRecord]] = await Promise.all([
      this.db
        .select({
          id: invoices.id,
          userId: invoices.userId,
          stripeInvoiceId: invoices.stripeInvoiceId,
          invoiceNumber: invoices.invoiceNumber,
          status: invoices.status,
          currency: invoices.currency,
          amountDue: invoices.amountDue,
          amountPaid: invoices.amountPaid,
          hostedInvoiceUrl: invoices.hostedInvoiceUrl,
          periodStart: invoices.periodStart,
          periodEnd: invoices.periodEnd,
          createdAt: invoices.createdAt,
        })
        .from(invoices)
        .orderBy(desc(invoices.createdAt))
        .limit(query.limit)
        .offset(offset),

      this.db.select({ total: count() }).from(invoices),
    ]);

    const total = totalRecord?.total ?? 0;

    return {
      invoices: invoiceRecords.map((invoice) => ({
        ...invoice,
        periodStart: invoice.periodStart.toISOString(),
        periodEnd: invoice.periodEnd.toISOString(),
        createdAt: invoice.createdAt.toISOString(),
      })),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }
}
