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

export type BillingInvoice = {
  id: string;
  stripeInvoiceId: string;
  invoiceNumber: string | null;
  status: string;
  currency: string;
  amountDue: number;
  amountPaid: number;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
  periodStart: string;
  periodEnd: string;
};

export type BillingInvoicesResponse = {
  invoices: BillingInvoice[];
};

export type BillingUpcomingInvoice = {
  currency: string;
  subtotal: number;
  total: number;
  amountDue: number;
  periodStart: string;
  periodEnd: string;
};

export type BillingUpcomingInvoiceResponse = {
  invoice: BillingUpcomingInvoice | null;
};

export type CreateBillingPortalResponse = {
  portalUrl: string;
};

export type CreateRefundRequest = {
  amount?: number;
};

export type CreateRefundResponse = {
  refundId: string;
  amount: number;
  currency: string;
  status: string | null;
};

export type AdminRefund = {
  id: string;
  userId: string;
  paymentId: string | null;
  invoiceId: string | null;
  stripeRefundId: string;
  stripeChargeId: string | null;
  stripePaymentIntentId: string | null;
  amount: number;
  currency: string;
  status: string;
  reason: string | null;
  failureReason: string | null;
  stripeCreatedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminRefundsResponse = {
  refunds: AdminRefund[];
};
