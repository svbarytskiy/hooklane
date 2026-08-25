import {
  integer,
  jsonb,
  pgTable,
  timestamp,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const workflowVersions = pgTable("workflow_versions", {
  id: uuid("id").primaryKey(),
  definition: jsonb("definition").notNull(),
});

export const incomingEvents = pgTable("incoming_events", {
  id: uuid("id").primaryKey(),
  workflowVersionId: uuid("workflow_version_id").notNull(),
  payload: jsonb("payload").notNull(),
});

export const integrationConnections = pgTable(
  "integration_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    providerAccountEmail: text("provider_account_email"),
    providerAccountName: text("provider_account_name"),
    status: text("status").notNull().default("active"),
    scopes: text("scopes").array().notNull().default([]),
    accessTokenCiphertext: text("access_token_ciphertext").notNull(),
    refreshTokenCiphertext: text("refresh_token_ciphertext"),
    tokenKeyVersion: integer("token_key_version").notNull().default(1),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    lastRefreshedAt: timestamp("last_refreshed_at", { withTimezone: true }),
    lastErrorCode: text("last_error_code"),
    lastErrorAt: timestamp("last_error_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdBy: uuid("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    workspaceProviderAccountUnique: uniqueIndex(
      "integration_connections_workspace_provider_account_unique",
    ).on(table.workspaceId, table.provider, table.providerAccountId),
  }),
);

export const oauthAuthorizationStates = pgTable(
  "oauth_authorization_states",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    stateHash: text("state_hash").notNull(),
    provider: text("provider").notNull(),
    workspaceId: uuid("workspace_id").notNull(),
    userId: uuid("user_id").notNull(),
    codeVerifierCiphertext: text("code_verifier_ciphertext").notNull(),
    codeVerifierKeyVersion: integer("code_verifier_key_version")
      .notNull()
      .default(1),
    redirectUri: text("redirect_uri").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    stateHashUnique: uniqueIndex(
      "oauth_authorization_states_state_hash_unique",
    ).on(table.stateHash),
  }),
);

export const executions = pgTable("executions", {
  id: uuid("id").primaryKey(),
  workspaceId: uuid("workspace_id").notNull(),
  workflowId: uuid("workflow_id").notNull(),
  status: text("status").notNull(),
  workflowVersionId: uuid("workflow_version_id").notNull(),
  incomingEventId: uuid("incoming_event_id").notNull(),
  queuedAt: timestamp("queued_at", { withTimezone: true }),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  failure: jsonb("failure"),
  eventSequence: integer("event_sequence").notNull().default(0),
  runSequence: integer("run_sequence").notNull().default(0),
  activeRecoveryId: uuid("active_recovery_id"),
  replayedFromExecutionId: uuid("replayed_from_execution_id"),
  deadLetteredAt: timestamp("dead_lettered_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const executionRecoveries = pgTable("execution_recoveries", {
  id: uuid("id").primaryKey().defaultRandom(),
  executionId: uuid("execution_id").notNull(),
  targetExecutionId: uuid("target_execution_id"),
  operation: text("operation").notNull(),
  fromAttemptId: uuid("from_attempt_id"),
  stepId: text("step_id"),
  startStepIndex: integer("start_step_index"),
  checkpoint: jsonb("checkpoint"),
  resolutionOutput: jsonb("resolution_output"),
  requestedBy: uuid("requested_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const executionAttempts = pgTable(
  "execution_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    executionId: uuid("execution_id").notNull(),
    attemptNumber: integer("attempt_number").notNull(),
    status: text("status").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    error: jsonb("error"),
  },
  (table) => ({
    executionAttemptUnique: uniqueIndex(
      "execution_attempts_execution_attempt_number_unique",
    ).on(table.executionId, table.attemptNumber),
  }),
);

export const executionSteps = pgTable(
  "execution_steps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    executionId: uuid("execution_id").notNull(),
    attemptId: uuid("attempt_id").notNull(),
    stepId: text("step_id").notNull(),
    stepIndex: integer("step_index").notNull(),
    status: text("status").notNull(),
    input: jsonb("input"),
    output: jsonb("output"),
    error: jsonb("error"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => ({
    attemptStepUnique: uniqueIndex("execution_steps_attempt_step_unique").on(
      table.attemptId,
      table.stepId,
    ),
  }),
);

export const executionOutbox = pgTable(
  "execution_outbox",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    executionId: uuid("execution_id").notNull(),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
    lastError: text("last_error"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    executionUnique: uniqueIndex("execution_outbox_execution_id_key").on(
      table.executionId,
    ),
  }),
);

export const executionNotificationOutbox = pgTable(
  "execution_notification_outbox",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id").notNull(),
    workflowId: uuid("workflow_id").notNull(),
    executionId: uuid("execution_id").notNull(),
    sequence: integer("sequence").notNull(),
    eventType: text("event_type").notNull(),
    data: jsonb("data").notNull().default({}),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
    claimToken: uuid("claim_token"),
    claimExpiresAt: timestamp("claim_expires_at", { withTimezone: true }),
    lastError: text("last_error"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    executionSequenceUnique: uniqueIndex(
      "execution_notification_outbox_execution_sequence_unique",
    ).on(table.executionId, table.sequence),
  }),
);

export type Execution = typeof executions.$inferSelect;
