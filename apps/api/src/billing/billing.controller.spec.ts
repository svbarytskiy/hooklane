import { BillingController } from './billing.controller';
import type { AuthenticatedUser } from 'src/auth/auth.types';
import type { BillingService } from './billing.service';
import type { CheckoutService } from './checkout.service';
import type { SubscriptionCheckoutService } from './subscription-checkout.service';
import type { SubscriptionService } from './subscription.service';
import type { InvoiceService } from './invoice.service';

describe('BillingController', () => {
  it('delegates billing state lookup to the billing service', async () => {
    const state = { stripeCustomer: null };
    const getBillingState = jest.fn().mockResolvedValue(state);
    const billingService = { getBillingState } as unknown as BillingService;
    const controller = new BillingController(
      billingService,
      {} as CheckoutService,
      {} as SubscriptionCheckoutService,
      {} as SubscriptionService,
      {} as InvoiceService,
    );
    const user: AuthenticatedUser = { id: 'user_1', email: 'user@example.com' };

    await expect(controller.getBillingState(user)).resolves.toEqual(state);
    expect(getBillingState).toHaveBeenCalledWith('user_1');
  });
});
