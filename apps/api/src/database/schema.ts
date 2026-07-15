import { sql } from 'drizzle-orm';

import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
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
