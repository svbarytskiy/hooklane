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
