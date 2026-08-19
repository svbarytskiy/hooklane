import { and, eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  executionAttempts,
  executionOutbox,
  executionSteps,
  executions,
  incomingEvents,
  workflowVersions,
} from "./schema.js";

export type ExecutionContext = {
  executionId: string;
  payload: unknown;
  definition: unknown;
};

export type ExecutionRepository = {
  ping(): Promise<void>;
  claimExecution(executionId: string): Promise<boolean>;
  isExecutionCancelled(executionId: string): Promise<boolean>;
  loadExecutionContext(executionId: string): Promise<ExecutionContext>;
  markSucceeded(executionId: string): Promise<void>;
  markFailed(executionId: string, failure: { message: string }): Promise<void>;
  markRetryableFailure(
    executionId: string,
    failure: { message: string },
  ): Promise<void>;
  startAttempt(executionId: string, attemptNumber: number): Promise<string>;
  completeAttempt(
    attemptId: string,
    status: "succeeded" | "failed",
    error?: { message: string },
  ): Promise<void>;
  startStep(
    executionId: string,
    attemptId: string,
    stepId: string,
    stepIndex: number,
    input?: unknown,
  ): Promise<string>;
  completeStep(
    stepRecordId: string,
    status: "succeeded" | "failed",
    output?: unknown,
    error?: { code: string; message: string; stepId?: string },
  ): Promise<void>;
  skipStep(
    executionId: string,
    attemptId: string,
    stepId: string,
    stepIndex: number,
    input?: unknown,
  ): Promise<void>;
  createOutbox(executionId: string): Promise<string>;
  listPendingOutbox(
    limit: number,
  ): Promise<Array<{ id: string; executionId: string }>>;
  markOutboxPublished(id: string): Promise<void>;
  markOutboxFailed(id: string, message: string): Promise<void>;
  close(): Promise<void>;
};

export function createExecutionRepository(
  databaseUrl: string,
): ExecutionRepository {
  const client = postgres(databaseUrl, { max: 5 });
  const db = drizzle(client, {
    schema: {
      executions,
      incomingEvents,
      workflowVersions,
      executionAttempts,
      executionSteps,
      executionOutbox,
    },
  });

  return {
    async ping() {
      await db.execute(sql`select 1`);
    },
    async loadExecutionContext(executionId) {
      const [context] = await db
        .select({
          executionId: executions.id,
          payload: incomingEvents.payload,
          definition: workflowVersions.definition,
        })
        .from(executions)
        .innerJoin(
          incomingEvents,
          eq(incomingEvents.id, executions.incomingEventId),
        )
        .innerJoin(
          workflowVersions,
          eq(workflowVersions.id, executions.workflowVersionId),
        )
        .where(eq(executions.id, executionId))
        .limit(1);

      if (!context) {
        throw new Error(`Execution context ${executionId} was not found`);
      }

      return context;
    },

    async claimExecution(executionId) {
      const [current] = await db
        .select({ status: executions.status })
        .from(executions)
        .where(eq(executions.id, executionId))
        .limit(1);

      if (!current) {
        throw new Error(`Execution ${executionId} was not found`);
      }

      if (!["pending", "queued"].includes(current.status)) {
        return false;
      }

      const claimed = await db
        .update(executions)
        .set({
          status: "running",
          startedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(executions.id, executionId),
            inArray(executions.status, ["pending", "queued"]),
          ),
        )
        .returning({ id: executions.id });

      return claimed.length === 1;
    },

    async isExecutionCancelled(executionId) {
      const [execution] = await db
        .select({ status: executions.status })
        .from(executions)
        .where(eq(executions.id, executionId))
        .limit(1);

      if (!execution) {
        throw new Error(`Execution ${executionId} was not found`);
      }

      return execution.status === "cancelled";
    },

    async markSucceeded(executionId) {
      await db
        .update(executions)
        .set({
          status: "succeeded",
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(eq(executions.id, executionId), eq(executions.status, "running")),
        );
    },

    async markFailed(executionId, failure) {
      await db
        .update(executions)
        .set({
          status: "failed",
          failure,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(eq(executions.id, executionId), eq(executions.status, "running")),
        );
    },

    async markRetryableFailure(executionId, failure) {
      await db
        .update(executions)
        .set({
          status: "queued",
          failure,
          updatedAt: new Date(),
        })
        .where(
          and(eq(executions.id, executionId), eq(executions.status, "running")),
        );
    },

    async startAttempt(executionId, attemptNumber) {
      const [attempt] = await db
        .insert(executionAttempts)
        .values({
          executionId,
          attemptNumber,
          status: "running",
          startedAt: new Date(),
        })
        .returning({ id: executionAttempts.id });

      if (!attempt) {
        throw new Error(`Attempt for execution ${executionId} was not created`);
      }

      return attempt.id;
    },

    async completeAttempt(attemptId, status, error) {
      await db
        .update(executionAttempts)
        .set({ status, completedAt: new Date(), error: error ?? null })
        .where(
          and(
            eq(executionAttempts.id, attemptId),
            eq(executionAttempts.status, "running"),
          ),
        );
    },

    async startStep(executionId, attemptId, stepId, stepIndex, input) {
      const [step] = await db
        .insert(executionSteps)
        .values({
          executionId,
          attemptId,
          stepId,
          stepIndex,
          status: "running",
          input: input ?? null,
          startedAt: new Date(),
        })
        .returning({ id: executionSteps.id });

      if (!step) throw new Error(`Step ${stepId} was not created`);
      return step.id;
    },

    async completeStep(stepRecordId, status, output, error) {
      await db
        .update(executionSteps)
        .set({
          status,
          output: output ?? null,
          error: error ?? null,
          completedAt: new Date(),
        })
        .where(
          and(
            eq(executionSteps.id, stepRecordId),
            eq(executionSteps.status, "running"),
          ),
        );
    },

    async skipStep(executionId, attemptId, stepId, stepIndex, input) {
      const now = new Date();
      await db.insert(executionSteps).values({
        executionId,
        attemptId,
        stepId,
        stepIndex,
        status: "skipped",
        input: input ?? null,
        startedAt: now,
        completedAt: now,
      });
    },

    async createOutbox(executionId) {
      const [entry] = await db
        .insert(executionOutbox)
        .values({ executionId, createdAt: new Date() })
        .returning({ id: executionOutbox.id });

      if (!entry) throw new Error("Execution outbox entry was not created");
      return entry.id;
    },

    async listPendingOutbox(limit) {
      return db
        .select({
          id: executionOutbox.id,
          executionId: executionOutbox.executionId,
        })
        .from(executionOutbox)
        .where(eq(executionOutbox.status, "pending"))
        .limit(limit);
    },

    async markOutboxPublished(id) {
      await db
        .update(executionOutbox)
        .set({ status: "published", publishedAt: new Date() })
        .where(eq(executionOutbox.id, id));
    },

    async markOutboxFailed(id, message) {
      await db
        .update(executionOutbox)
        .set({ lastError: message, attempts: 1 })
        .where(eq(executionOutbox.id, id));
    },

    async close() {
      await client.end({ timeout: 5 });
    },
  };
}
