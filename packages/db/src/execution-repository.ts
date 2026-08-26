import type {
  ExecutionNotificationData,
  ExecutionNotificationType,
} from "@hooklane/contracts";
import { and, eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  executionAttempts,
  executionNotificationOutbox,
  executionOutbox,
  executionRecoveries,
  executionSteps,
  executions,
  incomingEvents,
  integrationConnections,
  workflowVersions,
} from "./schema.js";

export type ExecutionContext = {
  executionId: string;
  workspaceId: string;
  payload: unknown;
  definition: unknown;
  startStepIndex: number;
  checkpoint: unknown;
};

export type ActiveSlackConnection = {
  id: string;
  accessTokenCiphertext: string;
  refreshTokenCiphertext: string | null;
  tokenKeyVersion: number;
  accessTokenExpiresAt: Date | null;
};

export type ExecutionRepository = {
  ping(): Promise<void>;
  tryAcquireExecutionSlot(executionId: string): Promise<"acquired" | "concurrency_limit_reached" | "skipped">;
  releaseExecutionSlot(executionId: string, terminal: boolean): Promise<void>;
  claimExecution(executionId: string): Promise<boolean>;
  isExecutionCancelled(executionId: string): Promise<boolean>;
  loadExecutionContext(executionId: string): Promise<ExecutionContext>;
  getActiveSlackConnection(
    workspaceId: string,
    connectionId: string,
  ): Promise<ActiveSlackConnection | undefined>;
  updateRefreshedSlackConnection(
    connectionId: string,
    previousRefreshTokenCiphertext: string,
    input: {
      accessTokenCiphertext: string;
      refreshTokenCiphertext: string;
      tokenKeyVersion: number;
      accessTokenExpiresAt: Date | null;
      scopes: string[];
    },
  ): Promise<boolean>;
  markSlackConnectionNeedsReconnect(
    connectionId: string,
    errorCode: string,
  ): Promise<void>;
  markSucceeded(executionId: string): Promise<void>;
  markFailed(executionId: string, failure: { message: string }): Promise<void>;
  markRetryableFailure(
    executionId: string,
    failure: { message: string },
  ): Promise<void>;
  startAttempt(
    executionId: string,
  ): Promise<{ id: string; attemptNumber: number }>;
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
      integrationConnections,
      workflowVersions,
      executionAttempts,
      executionSteps,
      executionOutbox,
      executionRecoveries,
      executionNotificationOutbox,
    },
  });

  type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

  async function appendNotification(
    tx: Transaction,
    executionId: string,
    eventType: ExecutionNotificationType,
    data: ExecutionNotificationData,
  ): Promise<void> {
    const [execution] = await tx
      .update(executions)
      .set({
        eventSequence: sql`${executions.eventSequence} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(executions.id, executionId))
      .returning({
        id: executions.id,
        workspaceId: executions.workspaceId,
        workflowId: executions.workflowId,
        sequence: executions.eventSequence,
      });

    if (!execution) {
      throw new Error(`Execution ${executionId} was not found`);
    }

    await tx.insert(executionNotificationOutbox).values({
      workspaceId: execution.workspaceId,
      workflowId: execution.workflowId,
      executionId: execution.id,
      sequence: execution.sequence,
      eventType,
      data,
    });
  }

  return {
    async ping() {
      await db.execute(sql`select 1`);
    },
    async tryAcquireExecutionSlot(executionId) {
      const rows = await db.execute(sql`select public.try_acquire_workspace_execution_slot(${executionId}) as result`);
      const result = (rows[0] as { result?: string } | undefined)?.result;
      if (result === "acquired" || result === "concurrency_limit_reached") return result;
      return "skipped";
    },
    async releaseExecutionSlot(executionId, terminal) {
      await db.execute(sql`select public.release_workspace_execution_slot(${executionId}, ${terminal})`);
    },
    async loadExecutionContext(executionId) {
      const [context] = await db
        .select({
          executionId: executions.id,
          workspaceId: executions.workspaceId,
          payload: incomingEvents.payload,
          definition: workflowVersions.definition,
          startStepIndex: executionRecoveries.startStepIndex,
          checkpoint: executionRecoveries.checkpoint,
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
        .leftJoin(
          executionRecoveries,
          eq(executionRecoveries.id, executions.activeRecoveryId),
        )
        .where(eq(executions.id, executionId))
        .limit(1);

      if (!context) {
        throw new Error(`Execution context ${executionId} was not found`);
      }

      return {
        ...context,
        startStepIndex: context.startStepIndex ?? 0,
      };
    },

    async getActiveSlackConnection(workspaceId, connectionId) {
      return db.query.integrationConnections.findFirst({
        columns: {
          id: true,
          accessTokenCiphertext: true,
          refreshTokenCiphertext: true,
          tokenKeyVersion: true,
          accessTokenExpiresAt: true,
        },
        where: and(
          eq(integrationConnections.id, connectionId),
          eq(integrationConnections.workspaceId, workspaceId),
          eq(integrationConnections.provider, "slack"),
          eq(integrationConnections.status, "active"),
        ),
      });
    },

    async updateRefreshedSlackConnection(
      connectionId,
      previousRefreshTokenCiphertext,
      input,
    ) {
      const updated = await db
        .update(integrationConnections)
        .set({
          ...input,
          status: "active",
          lastRefreshedAt: new Date(),
          lastErrorCode: null,
          lastErrorAt: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(integrationConnections.id, connectionId),
            eq(integrationConnections.status, "active"),
            eq(
              integrationConnections.refreshTokenCiphertext,
              previousRefreshTokenCiphertext,
            ),
          ),
        )
        .returning({ id: integrationConnections.id });
      return updated.length === 1;
    },

    async markSlackConnectionNeedsReconnect(connectionId, errorCode) {
      await db
        .update(integrationConnections)
        .set({
          status: "needs_reconnect",
          lastErrorCode: errorCode,
          lastErrorAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(integrationConnections.id, connectionId),
            eq(integrationConnections.status, "active"),
          ),
        );
    },

    async claimExecution(executionId) {
      return db.transaction(async (tx) => {
        const [current] = await tx
          .select({ status: executions.status })
          .from(executions)
          .where(eq(executions.id, executionId))
          .limit(1);

        if (!current) {
          throw new Error(`Execution ${executionId} was not found`);
        }

        if (!["pending", "queued", "running"].includes(current.status)) {
          return false;
        }

        const recoveredFromInterruptedWorker = current.status === "running";
        if (recoveredFromInterruptedWorker) {
          const interrupted = {
            code: "worker_interrupted",
            category: "internal",
            message: "Worker stopped before completing the attempt",
            retryable: true,
          };
          await tx
            .update(executionSteps)
            .set({
              status: "failed",
              error: interrupted,
              completedAt: new Date(),
            })
            .where(
              and(
                eq(executionSteps.executionId, executionId),
                eq(executionSteps.status, "running"),
              ),
            );
          await tx
            .update(executionAttempts)
            .set({
              status: "failed",
              error: interrupted,
              completedAt: new Date(),
            })
            .where(
              and(
                eq(executionAttempts.executionId, executionId),
                eq(executionAttempts.status, "running"),
              ),
            );
        }

        const claimed = await tx
          .update(executions)
          .set({
            status: "running",
            startedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(executions.id, executionId),
              inArray(executions.status, ["pending", "queued", "running"]),
            ),
          )
          .returning({ id: executions.id });

        if (claimed.length === 1) {
          await appendNotification(tx, executionId, "execution.started", {
            status: "running",
            recoveredFromInterruptedWorker,
          });
        }
        return claimed.length === 1;
      });
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
      await db.transaction(async (tx) => {
        const updated = await tx
          .update(executions)
          .set({
            status: "succeeded",
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(executions.id, executionId),
              eq(executions.status, "running"),
            ),
          )
          .returning({ id: executions.id });
        if (updated.length === 1) {
          await tx.execute(sql`select public.release_workspace_execution_slot(${executionId})`);
          await appendNotification(tx, executionId, "execution.succeeded", {
            status: "succeeded",
          });
        }
      });
    },

    async markFailed(executionId, failure) {
      await db.transaction(async (tx) => {
        const updated = await tx
          .update(executions)
          .set({
            status: "failed",
            failure,
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(executions.id, executionId),
              eq(executions.status, "running"),
            ),
          )
          .returning({ id: executions.id });
        if (updated.length === 1) {
          await tx.execute(sql`select public.release_workspace_execution_slot(${executionId})`);
          await appendNotification(tx, executionId, "execution.failed", {
            status: "failed",
          });
        }
      });
    },

    async markRetryableFailure(executionId, failure) {
      await db.transaction(async (tx) => {
        const updated = await tx
          .update(executions)
          .set({
            status: "queued",
            failure,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(executions.id, executionId),
              eq(executions.status, "running"),
            ),
          )
          .returning({ id: executions.id });
        if (updated.length === 1) {
          await tx.execute(sql`select public.release_workspace_execution_slot(${executionId}, false)`);
          await appendNotification(
            tx,
            executionId,
            "execution.retry_scheduled",
            { status: "queued" },
          );
        }
      });
    },

    async startAttempt(executionId) {
      return db.transaction(async (tx) => {
        const [attempt] = await tx
          .insert(executionAttempts)
          .values({
            executionId,
            attemptNumber: sql<number>`(
              select coalesce(max(${executionAttempts.attemptNumber}), 0) + 1
              from ${executionAttempts}
              where ${executionAttempts.executionId} = ${executionId}
            )`,
            status: "running",
            startedAt: new Date(),
          })
          .returning({
            id: executionAttempts.id,
            attemptNumber: executionAttempts.attemptNumber,
          });

        if (!attempt) {
          throw new Error(
            `Attempt for execution ${executionId} was not created`,
          );
        }
        await appendNotification(tx, executionId, "execution.attempt.started", {
          attemptId: attempt.id,
          attemptNumber: attempt.attemptNumber,
          status: "running",
        });
        return attempt;
      });
    },

    async completeAttempt(attemptId, status, error) {
      await db.transaction(async (tx) => {
        const [attempt] = await tx
          .update(executionAttempts)
          .set({ status, completedAt: new Date(), error: error ?? null })
          .where(
            and(
              eq(executionAttempts.id, attemptId),
              eq(executionAttempts.status, "running"),
            ),
          )
          .returning({
            executionId: executionAttempts.executionId,
            attemptNumber: executionAttempts.attemptNumber,
          });
        if (attempt) {
          await appendNotification(
            tx,
            attempt.executionId,
            status === "succeeded"
              ? "execution.attempt.succeeded"
              : "execution.attempt.failed",
            { attemptId, attemptNumber: attempt.attemptNumber, status },
          );
        }
      });
    },

    async startStep(executionId, attemptId, stepId, stepIndex, input) {
      return db.transaction(async (tx) => {
        const [step] = await tx
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
        await appendNotification(tx, executionId, "execution.step.started", {
          attemptId,
          stepId,
          stepIndex,
          status: "running",
        });
        return step.id;
      });
    },

    async completeStep(stepRecordId, status, output, error) {
      await db.transaction(async (tx) => {
        const [step] = await tx
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
          )
          .returning({
            executionId: executionSteps.executionId,
            attemptId: executionSteps.attemptId,
            stepId: executionSteps.stepId,
            stepIndex: executionSteps.stepIndex,
          });
        if (step) {
          await appendNotification(
            tx,
            step.executionId,
            status === "succeeded"
              ? "execution.step.succeeded"
              : "execution.step.failed",
            {
              attemptId: step.attemptId,
              stepId: step.stepId,
              stepIndex: step.stepIndex,
              status,
            },
          );
        }
      });
    },

    async skipStep(executionId, attemptId, stepId, stepIndex, input) {
      const now = new Date();
      await db.transaction(async (tx) => {
        await tx.insert(executionSteps).values({
          executionId,
          attemptId,
          stepId,
          stepIndex,
          status: "skipped",
          input: input ?? null,
          startedAt: now,
          completedAt: now,
        });
        await appendNotification(tx, executionId, "execution.step.skipped", {
          attemptId,
          stepId,
          stepIndex,
          status: "skipped",
        });
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
