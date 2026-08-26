import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from 'src/config/env.schema';
import { WorkspaceSubscriptionCheckoutService } from './workspace-subscription-checkout.service';

const workspaceId = '00000000-0000-4000-8000-000000000001';
const ownerId = '00000000-0000-4000-8000-000000000002';

function createService(billingOwnerUserId = ownerId) {
  const stripe = {
    prices: {
      retrieve: jest
        .fn()
        .mockResolvedValue({ active: true, type: 'recurring' }),
    },
    checkout: {
      sessions: {
        create: jest
          .fn()
          .mockResolvedValue({ url: 'https://checkout.stripe.test/session' }),
      },
    },
  };
  const billingService = {
    getOrCreateStripeCustomerId: jest.fn().mockResolvedValue('cus_123'),
  };
  const catalog = {
    getActiveProductByCode: jest.fn().mockResolvedValue({
      code: 'pro_monthly',
      type: 'subscription',
      stripePriceId: 'price_pro',
      billingPlanId: '00000000-0000-4000-8000-000000000003',
    }),
  };
  const entitlementSync = {
    getBillingContext: jest.fn().mockResolvedValue({
      billingOwnerUserId,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      status: 'active',
    }),
    linkStripeCustomer: jest.fn().mockResolvedValue(undefined),
  };
  const config = new ConfigService<Env, true>({
    WEB_URL: 'https://web.example.test',
  } as Env);
  const database = {
    select: jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([]),
        }),
      }),
    }),
    insert: jest.fn().mockReturnValue({
      values: jest.fn().mockReturnValue({
        onConflictDoNothing: jest.fn().mockResolvedValue(undefined),
      }),
    }),
    update: jest.fn().mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue(undefined),
      }),
    }),
  };

  return {
    service: new WorkspaceSubscriptionCheckoutService(
      stripe as never,
      billingService as never,
      catalog as never,
      entitlementSync as never,
      config,
      database as never,
    ),
    stripe,
    billingService,
    entitlementSync,
  };
}

describe('WorkspaceSubscriptionCheckoutService', () => {
  it('creates workspace-bound Stripe Checkout metadata for the mapped plan', async () => {
    const { service, stripe, entitlementSync } = createService();

    await expect(
      service.createCheckout(
        { id: ownerId, email: 'owner@example.test' },
        workspaceId,
        { productCode: 'pro_monthly' },
        'request-1',
      ),
    ).resolves.toEqual({ checkoutUrl: 'https://checkout.stripe.test/session' });

    expect(entitlementSync.linkStripeCustomer).toHaveBeenCalledWith(
      workspaceId,
      ownerId,
      'cus_123',
    );
    const [sessionInput, requestOptions] = stripe.checkout.sessions.create.mock
      .calls[0] as [
      {
        client_reference_id: string;
        metadata: Record<string, string>;
        subscription_data: { metadata: Record<string, string> };
      },
      { idempotencyKey: string },
    ];

    expect(sessionInput.client_reference_id).toBe(workspaceId);
    expect(sessionInput.metadata.workspaceId).toBe(workspaceId);
    expect(sessionInput.subscription_data.metadata.workspaceId).toBe(
      workspaceId,
    );
    expect(requestOptions).toEqual({
      idempotencyKey: `workspace-subscription-checkout:${workspaceId}:request-1`,
    });
  });

  it('allows only the workspace billing owner to start checkout', async () => {
    const { service } = createService('00000000-0000-4000-8000-000000000099');

    await expect(
      service.createCheckout(
        { id: ownerId, email: 'owner@example.test' },
        workspaceId,
        { productCode: 'pro_monthly' },
        'request-1',
      ),
    ).rejects.toThrow(ForbiddenException);
  });
});
