import { jsonb, pgTable, timestamp, text, uuid } from "drizzle-orm/pg-core";

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

export type Execution = typeof executions.$inferSelect;
