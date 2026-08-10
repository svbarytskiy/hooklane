import { and, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { executions, incomingEvents, workflowVersions } from "./schema.js";

export type ExecutionContext = {
  executionId: string;
  payload: unknown;
  definition: unknown;
};

export type ExecutionRepository = {
  claimExecution(executionId: string): Promise<boolean>;
  loadExecutionContext(executionId: string): Promise<ExecutionContext>;
  markSucceeded(executionId: string): Promise<void>;
  markFailed(executionId: string, failure: { message: string }): Promise<void>;
  close(): Promise<void>;
};

export function createExecutionRepository(
  databaseUrl: string,
): ExecutionRepository {
  const client = postgres(databaseUrl, { max: 5 });
  const db = drizzle(client, {
    schema: { executions, incomingEvents, workflowVersions },
  });

  return {
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

    async close() {
      await client.end({ timeout: 5 });
    },
  };
}
