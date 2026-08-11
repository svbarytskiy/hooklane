import {
  integer,
  jsonb,
  pgTable,
  timestamp,
  text,
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

export const executions = pgTable("executions", {
  id: uuid("id").primaryKey(),
  status: text("status").notNull(),
  workflowVersionId: uuid("workflow_version_id").notNull(),
  incomingEventId: uuid("incoming_event_id").notNull(),
  queuedAt: timestamp("queued_at", { withTimezone: true }),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  failure: jsonb("failure"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const executionAttempts = pgTable("execution_attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  executionId: uuid("execution_id").notNull(),
  attemptNumber: integer("attempt_number").notNull(),
  status: text("status").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  error: jsonb("error"),
});

export const executionSteps = pgTable("execution_steps", {
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
});

export const executionOutbox = pgTable("execution_outbox", {
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
});

export type Execution = typeof executions.$inferSelect;
