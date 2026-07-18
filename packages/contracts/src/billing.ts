export type StripeCustomerResponse = {
  id: string;
  stripeCustomerId: string;
  createdAt: string;
  updatedAt: string;
};

export type BillingStateResponse = {
  stripeCustomer: StripeCustomerResponse | null;
};

export type CreateCreditsCheckoutRequest = {
  productCode: string;
};

export type CreateCheckoutResponse = {
  paymentId: string;
  checkoutUrl: string;
};

export type BillingPaymentResponse = {
  id: string;
  productType: string;
  amount: number;
  currency: string;
  creditsAmount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type BillingPaymentsResponse = {
  payments: BillingPaymentResponse[];
};

export type CreditsBalanceResponse = {
  balance: number;
};

export type CreateSubscriptionCheckoutRequest = {
  productCode: string;
};

export type CreateSubscriptionCheckoutResponse = {
  checkoutUrl: string;
};

export type BillingSubscription = {
  id: string;
  stripeSubscriptionId: string;
  stripePriceId: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  trialEnd: string | null;
  canceledAt: string | null;
};

export type BillingSubscriptionResponse = {
  subscription: BillingSubscription | null;
};