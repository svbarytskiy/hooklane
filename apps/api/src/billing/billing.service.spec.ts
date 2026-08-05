import { BillingService } from './billing.service';
import type { ConfigService } from '@nestjs/config';
import type { Database } from 'src/database/database.types';
import type { StripeClient } from 'src/stripe/stripe.types';
import type { Env } from 'src/config/env.schema';

describe('BillingService', () => {
  it('maps a stored Stripe customer into billing state', async () => {
    const record = {
      id: 'record_1',
      stripeCustomerId: 'cus_123',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    };
    const limit = jest.fn().mockResolvedValue([record]);
    const where = jest.fn().mockReturnValue({ limit });
    const from = jest.fn().mockReturnValue({ where });
    const select = jest.fn().mockReturnValue({ from });
    const service = new BillingService(
      { select } as never as Database,
      {} as StripeClient,
      {} as ConfigService<Env, true>,
    );

    await expect(service.getBillingState('user_1')).resolves.toEqual({
      stripeCustomer: {
        id: 'record_1',
        stripeCustomerId: 'cus_123',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      },
    });
  });

  it('returns an empty customer state when no Stripe customer exists', async () => {
    const limit = jest.fn().mockResolvedValue([]);
    const where = jest.fn().mockReturnValue({ limit });
    const from = jest.fn().mockReturnValue({ where });
    const select = jest.fn().mockReturnValue({ from });
    const service = new BillingService(
      { select } as never as Database,
      {} as StripeClient,
      {} as ConfigService<Env, true>,
    );

    await expect(service.getBillingState('user_1')).resolves.toEqual({
      stripeCustomer: null,
    });
  });
});
