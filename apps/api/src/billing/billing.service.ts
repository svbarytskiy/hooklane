import {
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { DATABASE } from 'src/database/database.tokens';
import type { Database } from 'src/database/database.types';
import { STRIPE_CLIENT } from 'src/stripe/stripe.tokens';
import type { StripeClient } from 'src/stripe/stripe.types';
import { desc, eq, sql } from 'drizzle-orm';
import {
  creditTransactions,
  payments,
  stripeCustomers,
} from 'src/database/schema';
import type {
  AuthenticatedUser,
  BillingPaymentsResponse,
  BillingStateResponse,
  CreditsBalanceResponse,
  StripeCustomerResponse,
  CreateBillingPortalResponse,
} from '@hooklane/contracts';
import { ConfigService } from '@nestjs/config';
import { Env } from 'src/config/env.schema';

type StripeCustomerRecord = {
  id: string;
  stripeCustomerId: string;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class BillingService {
  constructor(
    @Inject(DATABASE)
    private readonly db: Database,

    @Inject(STRIPE_CLIENT)
    private readonly stripe: StripeClient,

    private readonly config: ConfigService<Env, true>,
  ) {}

  async createCustomer(
    user: AuthenticatedUser,
  ): Promise<StripeCustomerResponse> {
    const customer = await this.getOrCreateStripeCustomer(user);

    return {
      id: customer.id,
      stripeCustomerId: customer.stripeCustomerId,
      createdAt: customer.createdAt.toISOString(),
      updatedAt: customer.updatedAt.toISOString(),
    };
  }

  async getBillingState(userId: string): Promise<BillingStateResponse> {
    const customer = await this.findStripeCustomer(userId);

    return {
      stripeCustomer: customer
        ? {
            id: customer.id,
            stripeCustomerId: customer.stripeCustomerId,
            createdAt: customer.createdAt.toISOString(),
            updatedAt: customer.updatedAt.toISOString(),
          }
        : null,
    };
  }

  async getPayments(userId: string): Promise<BillingPaymentsResponse> {
    const paymentRecords = await this.db
      .select({
        id: payments.id,
        productType: payments.productType,
        amount: payments.amount,
        currency: payments.currency,
        creditsAmount: payments.creditsAmount,
        status: payments.status,
        createdAt: payments.createdAt,
        updatedAt: payments.updatedAt,
      })
      .from(payments)
      .where(eq(payments.userId, userId))
      .orderBy(desc(payments.createdAt))
      .limit(20);

    return {
      payments: paymentRecords.map((payment) => ({
        ...payment,
        createdAt: payment.createdAt.toISOString(),
        updatedAt: payment.updatedAt.toISOString(),
      })),
    };
  }

  async getCreditsBalance(userId: string): Promise<CreditsBalanceResponse> {
    const [result] = await this.db
      .select({
        balance: sql<number>`
        coalesce(sum(${creditTransactions.amount}), 0)::int
      `,
      })
      .from(creditTransactions)
      .where(eq(creditTransactions.userId, userId));

    return {
      balance: result?.balance ?? 0,
    };
  }

  async getOrCreateStripeCustomerId(user: AuthenticatedUser): Promise<string> {
    const customer = await this.getOrCreateStripeCustomer(user);

    return customer.stripeCustomerId;
  }

  private async findStripeCustomer(
    userId: string,
  ): Promise<StripeCustomerRecord | null> {
    const [customer] = await this.db
      .select({
        id: stripeCustomers.id,
        stripeCustomerId: stripeCustomers.stripeCustomerId,
        createdAt: stripeCustomers.createdAt,
        updatedAt: stripeCustomers.updatedAt,
      })
      .from(stripeCustomers)
      .where(eq(stripeCustomers.userId, userId))
      .limit(1);

    return customer ?? null;
  }

  private async getOrCreateStripeCustomer(
    user: AuthenticatedUser,
  ): Promise<StripeCustomerRecord> {
    const existingCustomer = await this.findStripeCustomer(user.id);

    if (existingCustomer) {
      return existingCustomer;
    }

    const stripeCustomer = await this.stripe.customers.create(
      {
        email: user.email ?? undefined,
        metadata: {
          userId: user.id,
        },
      },
      {
        idempotencyKey: `create-customer:${user.id}`,
      },
    );

    try {
      const [createdCustomer] = await this.db
        .insert(stripeCustomers)
        .values({
          userId: user.id,
          stripeCustomerId: stripeCustomer.id,
        })
        .returning({
          id: stripeCustomers.id,
          stripeCustomerId: stripeCustomers.stripeCustomerId,
          createdAt: stripeCustomers.createdAt,
          updatedAt: stripeCustomers.updatedAt,
        });

      if (!createdCustomer) {
        throw new InternalServerErrorException(
          'Stripe customer was created but database record was not returned',
        );
      }

      return createdCustomer;
    } catch (error) {
      if (!this.isUniqueViolation(error)) {
        throw error;
      }

      const existingCustomer = await this.findStripeCustomer(user.id);

      if (!existingCustomer) {
        throw new InternalServerErrorException(
          'Customer already exists, but could not be loaded',
        );
      }

      return existingCustomer;
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === '23505'
    );
  }

  async createBillingPortalSession(
    user: AuthenticatedUser,
  ): Promise<CreateBillingPortalResponse> {
    const stripeCustomerId = await this.getOrCreateStripeCustomerId(user);

    const webUrl = this.config.get('WEB_URL', {
      infer: true,
    });

    const portalSession = await this.stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${webUrl}/billing`,
    });

    return {
      portalUrl: portalSession.url,
    };
  }
}
