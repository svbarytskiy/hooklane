export type StripeCustomerResponse = {
  id: string;
  stripeCustomerId: string;
  createdAt: string;
  updatedAt: string;
};

export type BillingStateResponse = {
  stripeCustomer: StripeCustomerResponse | null;
};