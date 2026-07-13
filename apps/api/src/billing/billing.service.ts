import {
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { DATABASE } from 'src/database/database.tokens';
import type { Database } from 'src/database/database.types';
import { STRIPE_CLIENT } from 'src/stripe/stripe.tokens';
import type { StripeClient } from 'src/stripe/stripe.types';
import { eq } from 'drizzle-orm';
import { stripeCustomers } from 'src/database/schema';
import type {
  AuthenticatedUser,
  BillingStateResponse,
  StripeCustomerResponse,
} from '@billing-lab/contracts';

@Injectable()
export class BillingService {
  constructor(
    @Inject(DATABASE)
    private readonly db: Database,

    @Inject(STRIPE_CLIENT)
    private readonly stripe: StripeClient,
  ) {}

  async createCustomer(
    user: AuthenticatedUser,
  ): Promise<StripeCustomerResponse> {
    const [existingCustomer] = await this.db
      .select({
        id: stripeCustomers.id,
        stripeCustomerId: stripeCustomers.stripeCustomerId,
        createdAt: stripeCustomers.createdAt,
        updatedAt: stripeCustomers.updatedAt,
      })
      .from(stripeCustomers)
      .where(eq(stripeCustomers.userId, user.id))
      .limit(1);

    if (existingCustomer) {
      return {
        id: existingCustomer.id,
        stripeCustomerId: existingCustomer.stripeCustomerId,
        createdAt: existingCustomer.createdAt.toISOString(),
        updatedAt: existingCustomer.updatedAt.toISOString(),
      };
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
    return {
      id: createdCustomer.id,
      stripeCustomerId: createdCustomer.stripeCustomerId,
      createdAt: createdCustomer.createdAt.toISOString(),
      updatedAt: createdCustomer.updatedAt.toISOString(),
    };
  }

  async getBillingState(userId: string) {
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

    const response: BillingStateResponse = {
      stripeCustomer: customer
        ? {
            id: customer.id,
            stripeCustomerId: customer.stripeCustomerId,
            createdAt: customer.createdAt.toISOString(),
            updatedAt: customer.updatedAt.toISOString(),
          }
        : null,
    };
    return response;
  }
}
