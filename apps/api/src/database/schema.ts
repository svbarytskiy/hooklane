import { sql } from 'drizzle-orm';

import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
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

export const workspaces = pgTable(
  'workspaces',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
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
    slugUnique: uniqueIndex('workspaces_slug_unique').on(table.slug),
  }),
);

export const workspaceMembers = pgTable(
  'workspace_members',
  {
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    createdAt: timestamp('created_at', {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    primaryKey: primaryKey({
      columns: [table.workspaceId, table.userId],
      name: 'workspace_members_pkey',
    }),
    userIdIdx: index('workspace_members_user_id_idx').on(table.userId),
    roleAllowed: check(
      'workspace_members_role_allowed',
      sql`${table.role} in ('owner', 'admin', 'member')`,
    ),
  }),
);

export const workflows = pgTable(
  'workflows',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    status: text('status').notNull().default('active'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => profiles.id, { onDelete: 'restrict' }),
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
    workspaceSlugUnique: uniqueIndex('workflows_workspace_slug_unique').on(
      table.workspaceId,
      table.slug,
    ),
    workspaceIdIdx: index('workflows_workspace_id_idx').on(table.workspaceId),
    statusAllowed: check(
      'workflows_status_allowed',
      sql`${table.status} in ('active', 'archived')`,
    ),
  }),
);

export const workflowVersions = pgTable(
  'workflow_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workflowId: uuid('workflow_id')
      .notNull()
      .references(() => workflows.id, { onDelete: 'cascade' }),
    versionNumber: integer('version_number').notNull(),
    state: text('state').notNull().default('draft'),
    definition: jsonb('definition').notNull(),
    validationErrors: jsonb('validation_errors'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => profiles.id, { onDelete: 'restrict' }),
    publishedAt: timestamp('published_at', { withTimezone: true }),
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
    workflowVersionUnique: uniqueIndex(
      'workflow_versions_workflow_version_unique',
    ).on(table.workflowId, table.versionNumber),
    oneDraftPerWorkflow: uniqueIndex('workflow_versions_one_draft_per_workflow')
      .on(table.workflowId)
      .where(sql`${table.state} = 'draft'`),
    workflowIdIdx: index('workflow_versions_workflow_id_idx').on(
      table.workflowId,
    ),
    versionNumberPositive: check(
      'workflow_versions_version_number_positive',
      sql`${table.versionNumber} > 0`,
    ),
    stateAllowed: check(
      'workflow_versions_state_allowed',
      sql`${table.state} in ('draft', 'published')`,
    ),
    publishedAtMatchesState: check(
      'workflow_versions_published_at_matches_state',
      sql`(${table.state} = 'draft' and ${table.publishedAt} is null) or (${table.state} = 'published' and ${table.publishedAt} is not null)`,
    ),
  }),
);

export const workflowAuditRecords = pgTable(
  'workflow_audit_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    workflowId: uuid('workflow_id')
      .notNull()
      .references(() => workflows.id, { onDelete: 'cascade' }),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'restrict' }),
    eventType: text('event_type').notNull(),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    workflowCreatedAtIdx: index(
      'workflow_audit_records_workflow_created_at_idx',
    ).on(table.workflowId, table.createdAt),
    workspaceCreatedAtIdx: index(
      'workflow_audit_records_workspace_created_at_idx',
    ).on(table.workspaceId, table.createdAt),
    eventTypeAllowed: check(
      'workflow_audit_records_event_type_allowed',
      sql`${table.eventType} in ('workflow_created', 'draft_updated', 'workflow_published', 'workflow_archived')`,
    ),
  }),
);

export const webhookEndpoints = pgTable(
  'webhook_endpoints',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    workflowId: uuid('workflow_id')
      .notNull()
      .references(() => workflows.id, { onDelete: 'cascade' }),

    name: text('name').notNull(),

    // Random public identifier, e.g. wh_...
    // This is safe to place in a URL; it is not a signing secret.
    publicId: text('public_id').notNull(),

    status: text('status').notNull().default('active'),

    signatureMode: text('signature_mode').notNull().default('none'),

    // Never store plaintext secret. The API will later encrypt it before writing.
    signingSecretCiphertext: text('signing_secret_ciphertext'),

    secretLastRotatedAt: timestamp('secret_last_rotated_at', {
      withTimezone: true,
    }),

    createdBy: uuid('created_by')
      .notNull()
      .references(() => profiles.id, { onDelete: 'restrict' }),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    publicIdUnique: uniqueIndex('webhook_endpoints_public_id_unique').on(
      table.publicId,
    ),
    workspaceIdIdx: index('webhook_endpoints_workspace_id_idx').on(
      table.workspaceId,
    ),
    workflowIdIdx: index('webhook_endpoints_workflow_id_idx').on(
      table.workflowId,
    ),
    workflowNameUnique: uniqueIndex(
      'webhook_endpoints_workflow_name_unique',
    ).on(table.workflowId, table.name),
    nameNotBlank: check(
      'webhook_endpoints_name_not_blank',
      sql`length(trim(${table.name})) > 0`,
    ),
    statusAllowed: check(
      'webhook_endpoints_status_allowed',
      sql`${table.status} in ('active', 'inactive')`,
    ),
    signatureModeAllowed: check(
      'webhook_endpoints_signature_mode_allowed',
      sql`${table.signatureMode} in ('none', 'hmac_sha256')`,
    ),
    secretMatchesSignatureMode: check(
      'webhook_endpoints_secret_matches_signature_mode',
      sql`(${table.signatureMode} = 'none' and ${table.signingSecretCiphertext} is null) or (${table.signatureMode} = 'hmac_sha256' and ${table.signingSecretCiphertext} is not null)`,
    ),
  }),
);

export const incomingEvents = pgTable(
  'incoming_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    webhookEndpointId: uuid('webhook_endpoint_id')
      .notNull()
      .references(() => webhookEndpoints.id, { onDelete: 'restrict' }),

    workflowId: uuid('workflow_id')
      .notNull()
      .references(() => workflows.id, { onDelete: 'restrict' }),

    workflowVersionId: uuid('workflow_version_id')
      .notNull()
      .references(() => workflowVersions.id, { onDelete: 'restrict' }),

    // Optional caller-provided replay/idempotency key.
    // In the public protocol we will call it X-Hooklane-Event-Id.
    sourceEventId: text('source_event_id'),

    contentType: text('content_type').notNull(),
    payload: jsonb('payload').notNull(),
    payloadSha256: text('payload_sha256').notNull(),
    payloadSizeBytes: integer('payload_size_bytes').notNull(),

    status: text('status').notNull().default('accepted'),

    receivedAt: timestamp('received_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    endpointSourceEventUnique: uniqueIndex(
      'incoming_events_endpoint_source_event_unique',
    )
      .on(table.webhookEndpointId, table.sourceEventId)
      .where(sql`${table.sourceEventId} is not null`),

    workspaceReceivedAtIdx: index(
      'incoming_events_workspace_received_at_idx',
    ).on(table.workspaceId, table.receivedAt),

    endpointReceivedAtIdx: index('incoming_events_endpoint_received_at_idx').on(
      table.webhookEndpointId,
      table.receivedAt,
    ),

    workflowVersionIdIdx: index('incoming_events_workflow_version_id_idx').on(
      table.workflowVersionId,
    ),

    payloadSizePositive: check(
      'incoming_events_payload_size_positive',
      sql`${table.payloadSizeBytes} > 0`,
    ),
    statusAllowed: check(
      'incoming_events_status_allowed',
      sql`${table.status} in ('accepted')`,
    ),
  }),
);

export const executions = pgTable(
  'executions',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),

    workflowId: uuid('workflow_id')
      .notNull()
      .references(() => workflows.id, { onDelete: 'restrict' }),

    workflowVersionId: uuid('workflow_version_id')
      .notNull()
      .references(() => workflowVersions.id, { onDelete: 'restrict' }),

    incomingEventId: uuid('incoming_event_id')
      .notNull()
      .references(() => incomingEvents.id, { onDelete: 'restrict' }),

    status: text('status').notNull().default('pending'),

    queuedAt: timestamp('queued_at', { withTimezone: true }),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),

    failure: jsonb('failure'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    incomingEventUnique: uniqueIndex('executions_incoming_event_id_unique').on(
      table.incomingEventId,
    ),

    workspaceCreatedAtIdx: index('executions_workspace_created_at_idx').on(
      table.workspaceId,
      table.createdAt,
    ),

    workflowStatusCreatedAtIdx: index(
      'executions_workflow_status_created_at_idx',
    ).on(table.workflowId, table.status, table.createdAt),

    statusAllowed: check(
      'executions_status_allowed',
      sql`${table.status} in ('pending', 'queued', 'running', 'succeeded', 'failed', 'cancelled')`,
    ),
  }),
);

export const executionOutbox = pgTable('execution_outbox', {
  id: uuid('id').primaryKey().defaultRandom(),
  executionId: uuid('execution_id').notNull(),
  status: text('status').notNull().default('pending'),
  attempts: integer('attempts').notNull().default(0),
  nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }),
  lastError: text('last_error'),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
