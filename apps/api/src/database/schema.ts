import { sql } from 'drizzle-orm';

import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(),
  email: text('email'),
  role: text('role').notNull().default('user'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const stripeCustomers = pgTable(
  'stripe_customers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    stripeCustomerId: text('stripe_customer_id').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userIdUnique: unique('stripe_customers_user_id_unique').on(table.userId),
  }),
);

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),

    stripeCustomerId: text('stripe_customer_id').notNull(),

    stripeCheckoutSessionId: text('stripe_checkout_session_id').unique(),

    stripePaymentIntentId: text('stripe_payment_intent_id').unique(),

    checkoutIdempotencyKey: text('checkout_idempotency_key'),

    productType: text('product_type').notNull(),

    amount: integer('amount').notNull(),

    currency: text('currency').notNull().default('usd'),

    creditsAmount: integer('credits_amount').notNull(),

    status: text('status').notNull().default('pending'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userIdIdx: index('payments_user_id_idx').on(table.userId),
    statusIdx: index('payments_status_idx').on(table.status),

    amountPositive: check('payments_amount_positive', sql`${table.amount} > 0`),

    creditsAmountPositive: check(
      'payments_credits_amount_positive',
      sql`${table.creditsAmount} > 0`,
    ),

    statusAllowed: check(
      'payments_status_allowed',
      sql`${table.status} in ('pending', 'paid', 'failed', 'canceled', 'expired')`,
    ),
  }),
);

export const creditTransactions = pgTable(
  'credit_transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),

    paymentId: uuid('payment_id').references(() => payments.id, {
      onDelete: 'set null',
    }),

    refundId: uuid('refund_id').references(() => refunds.id, {
      onDelete: 'set null',
    }),

    amount: integer('amount').notNull(),

    type: text('type').notNull(),

    description: text('description'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userIdIdx: index('credit_transactions_user_id_idx').on(table.userId),

    paymentIdIdx: index('credit_transactions_payment_id_idx').on(
      table.paymentId,
    ),

    refundIdUnique: uniqueIndex('credit_transactions_refund_id_unique')
      .on(table.refundId)
      .where(sql`${table.refundId} is not null`),

    purchasePaymentUnique: uniqueIndex(
      'credit_transactions_purchase_payment_unique',
    )
      .on(table.paymentId)
      .where(
        sql`${table.type} = 'purchase' and ${table.paymentId} is not null`,
      ),

    amountNonZero: check(
      'credit_transactions_amount_non_zero',
      sql`${table.amount} <> 0`,
    ),

    typeAllowed: check(
      'credit_transactions_type_allowed',
      sql`${table.type} in ('purchase', 'refund', 'adjustment')`,
    ),
  }),
);

export const billingCatalog = pgTable(
  'billing_catalog',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    code: text('code').notNull().unique(),

    stripeProductId: text('stripe_product_id').notNull(),

    stripePriceId: text('stripe_price_id').notNull().unique(),

    type: text('type').notNull(),

    creditsAmount: integer('credits_amount'),

    active: boolean('active').notNull().default(true),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    activeIdx: index('billing_catalog_active_idx').on(table.active),
    typeIdx: index('billing_catalog_type_idx').on(table.type),
  }),
);

export const stripeWebhookEvents = pgTable(
  'stripe_webhook_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    stripeEventId: text('stripe_event_id').notNull().unique(),

    eventType: text('event_type').notNull(),

    status: text('status').notNull().default('received'),

    payload: jsonb('payload').notNull(),

    error: text('error'),

    receivedAt: timestamp('received_at', {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),

    processedAt: timestamp('processed_at', {
      withTimezone: true,
    }),

    createdAt: timestamp('created_at', {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    statusIdx: index('stripe_webhook_events_status_idx').on(table.status),

    eventTypeIdx: index('stripe_webhook_events_event_type_idx').on(
      table.eventType,
    ),

    statusAllowed: check(
      'stripe_webhook_events_status_allowed',
      sql`${table.status} in ('received', 'processed', 'failed', 'ignored')`,
    ),
  }),
);

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),

    stripeCustomerId: text('stripe_customer_id').notNull(),

    stripeSubscriptionId: text('stripe_subscription_id').notNull().unique(),

    stripeSubscriptionItemId: text('stripe_subscription_item_id')
      .notNull()
      .unique(),

    stripePriceId: text('stripe_price_id').notNull(),

    status: text('status').notNull(),

    currentPeriodStart: timestamp('current_period_start', {
      withTimezone: true,
    }).notNull(),

    currentPeriodEnd: timestamp('current_period_end', {
      withTimezone: true,
    }).notNull(),

    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),

    trialEnd: timestamp('trial_end', {
      withTimezone: true,
    }),

    canceledAt: timestamp('canceled_at', {
      withTimezone: true,
    }),

    createdAt: timestamp('created_at', {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp('updated_at', {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userIdIdx: index('subscriptions_user_id_idx').on(table.userId),

    statusIdx: index('subscriptions_status_idx').on(table.status),

    oneCurrentPerUser: uniqueIndex('subscriptions_one_current_per_user_unique')
      .on(table.userId)
      .where(
        sql`${table.status} in ('incomplete', 'trialing', 'active', 'past_due', 'unpaid', 'paused')`,
      ),

    statusAllowed: check(
      'subscriptions_status_allowed',
      sql`${table.status} in (
        'incomplete',
        'incomplete_expired',
        'trialing',
        'active',
        'past_due',
        'canceled',
        'unpaid',
        'paused'
      )`,
    ),
  }),
);

export const invoices = pgTable(
  'invoices',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),

    stripeInvoiceId: text('stripe_invoice_id').notNull().unique(),

    stripeCustomerId: text('stripe_customer_id').notNull(),

    stripeSubscriptionId: text('stripe_subscription_id'),

    invoiceNumber: text('invoice_number'),

    status: text('status').notNull(),

    currency: text('currency').notNull(),

    amountDue: integer('amount_due').notNull(),

    amountPaid: integer('amount_paid').notNull(),

    hostedInvoiceUrl: text('hosted_invoice_url'),

    invoicePdf: text('invoice_pdf'),

    periodStart: timestamp('period_start', {
      withTimezone: true,
    }).notNull(),

    periodEnd: timestamp('period_end', {
      withTimezone: true,
    }).notNull(),

    stripeCreatedAt: timestamp('stripe_created_at', {
      withTimezone: true,
    }).notNull(),

    createdAt: timestamp('created_at', {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp('updated_at', {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userIdPeriodEndIdx: index('invoices_user_id_period_end_idx').on(
      table.userId,
      table.periodEnd.desc(),
    ),

    stripeCustomerIdIdx: index('invoices_stripe_customer_id_idx').on(
      table.stripeCustomerId,
    ),

    stripeSubscriptionIdIdx: index('invoices_stripe_subscription_id_idx')
      .on(table.stripeSubscriptionId)
      .where(sql`${table.stripeSubscriptionId} is not null`),

    statusIdx: index('invoices_status_idx').on(table.status),

    statusAllowed: check(
      'invoices_status_allowed',
      sql`${table.status} in ('draft', 'open', 'paid', 'uncollectible', 'void')`,
    ),
  }),
);

export const refunds = pgTable(
  'refunds',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),

    paymentId: uuid('payment_id').references(() => payments.id, {
      onDelete: 'cascade',
    }),

    invoiceId: uuid('invoice_id').references(() => invoices.id, {
      onDelete: 'cascade',
    }),

    stripeRefundId: text('stripe_refund_id').notNull().unique(),

    stripeChargeId: text('stripe_charge_id'),

    stripePaymentIntentId: text('stripe_payment_intent_id'),

    amount: integer('amount').notNull(),

    currency: text('currency').notNull(),

    status: text('status').notNull(),

    reason: text('reason'),

    failureReason: text('failure_reason'),

    stripeCreatedAt: timestamp('stripe_created_at', {
      withTimezone: true,
    }).notNull(),

    createdAt: timestamp('created_at', {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp('updated_at', {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userIdCreatedAtIdx: index('refunds_user_id_created_at_idx').on(
      table.userId,
      table.createdAt.desc(),
    ),

    paymentIdIdx: index('refunds_payment_id_idx')
      .on(table.paymentId)
      .where(sql`${table.paymentId} is not null`),

    invoiceIdIdx: index('refunds_invoice_id_idx')
      .on(table.invoiceId)
      .where(sql`${table.invoiceId} is not null`),

    statusIdx: index('refunds_status_idx').on(table.status),

    stripePaymentIntentIdIdx: index('refunds_stripe_payment_intent_id_idx')
      .on(table.stripePaymentIntentId)
      .where(sql`${table.stripePaymentIntentId} is not null`),

    amountPositive: check('refunds_amount_positive', sql`${table.amount} > 0`),

    statusAllowed: check(
      'refunds_status_allowed',
      sql`${table.status} in ('pending', 'requires_action', 'succeeded', 'failed', 'canceled')`,
    ),

    exactlyOneSource: check(
      'refunds_exactly_one_source',
      sql`(
        (${table.paymentId} is not null and ${table.invoiceId} is null)
        or
        (${table.paymentId} is null and ${table.invoiceId} is not null)
      )`,
    ),
  }),
);

export const profileAvatars = pgTable(
  'profile_avatars',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    bucketId: text('bucket_id').notNull().default('avatars'),
    objectPath: text('object_path').notNull().unique(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    bucketAllowed: check(
      'profile_avatars_bucket_allowed',
      sql`${table.bucketId} = 'avatars'`,
    ),
    mimeTypeAllowed: check(
      'profile_avatars_mime_type_allowed',
      sql`${table.mimeType} in ('image/jpeg', 'image/png', 'image/webp')`,
    ),
    sizeAllowed: check(
      'profile_avatars_size_allowed',
      sql`${table.sizeBytes} > 0 and ${table.sizeBytes} <= 5242880`,
    ),
    pathOwned: check(
      'profile_avatars_path_owned',
      sql`${table.objectPath} like ${table.userId}::text || '/%'`,
    ),
  }),
);
