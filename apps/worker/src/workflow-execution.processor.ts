import type { ExecuteWorkflowJob } from "@hooklane/contracts";
import { createWorkflowExecutionWorker } from "@hooklane/queue";
import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Job, Worker } from "bullmq";
import type { WorkerEnv } from "./config/env.schema";
import { WorkerDatabaseService } from "./database/worker-database.service";
import { WorkflowExecutionRunner } from "./workflow-execution.runner";

@Injectable()
export class WorkflowExecutionProcessor
  implements OnModuleInit, OnModuleDestroy
{
  private worker?: Worker<ExecuteWorkflowJob>;

  constructor(
    private readonly config: ConfigService<WorkerEnv, true>,
    private readonly database: WorkerDatabaseService,
    private readonly runner: WorkflowExecutionRunner,
  ) {}

  async onModuleInit(): Promise<void> {
    const redisUrl = this.config.get("REDIS_URL", { infer: true });

    this.worker = createWorkflowExecutionWorker(
      redisUrl,
      (job) => this.process(job),
      {
        attempts: this.config.get("WORKFLOW_MAX_ATTEMPTS", { infer: true }),
        backoffDelayMs: this.config.get("WORKFLOW_BACKOFF_DELAY_MS", {
          infer: true,
        }),
        concurrency: this.config.get("WORKFLOW_QUEUE_CONCURRENCY", {
          infer: true,
        }),
        removeOnComplete: this.config.get("WORKFLOW_COMPLETED_RETENTION", {
          infer: true,
        }),
        removeOnFail: this.config.get("WORKFLOW_FAILED_RETENTION", {
          infer: true,
        }),
      },
    );

    this.worker.on("completed", (job) => {
      console.log(`[worker] completed job=${job.id}`);
    });
    this.worker.on("failed", (job, error) => {
      console.error(`[worker] failed job=${job?.id}`, error);
    });
    this.worker.on("error", (error) => {
      console.error("[worker] infrastructure error", error);
    });

    await Promise.all([this.worker.waitUntilReady(), this.database.ping()]);
    console.log("[worker] ready redis=ok postgres=ok");
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  private async process(job: Job<ExecuteWorkflowJob>): Promise<void> {
    console.log(
      `[worker] processing job=${job.id} execution=${job.data.executionId}`,
    );

    const claimed = await this.database.claimExecution(job.data.executionId);

    if (!claimed) {
      console.log(
        `[worker] skipping execution=${job.data.executionId}; it is already terminal or being processed`,
      );
      return;
    }

    let attemptId: string | undefined;
    try {
      attemptId = await this.database.startAttempt(
        job.data.executionId,
        job.attemptsMade + 1,
      );
      const currentAttemptId = attemptId;
      const context = await this.database.loadExecutionContext(
        job.data.executionId,
      );
      const result = await this.runner.run({
        ...context,
        onStep: (step, index, output) =>
          this.database.recordStep(
            job.data.executionId,
            currentAttemptId,
            step.id,
            index,
            "succeeded",
            output,
          ),
      });
      await this.database.completeAttempt(currentAttemptId, "succeeded");
      console.log(
        `[worker] executed execution=${context.executionId} steps=${result.executedSteps}`,
      );
      await this.database.markSucceeded(job.data.executionId);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown workflow error";
      if (attemptId) {
        await this.database.completeAttempt(attemptId, "failed", { message });
      }
      const maxAttempts = this.config.get("WORKFLOW_MAX_ATTEMPTS", {
        infer: true,
      });
      const hasRetryLeft = job.attemptsMade + 1 < maxAttempts;
      if (hasRetryLeft) {
        await this.database.markRetryableFailure(job.data.executionId, {
          message,
        });
      } else {
        await this.database.markFailed(job.data.executionId, { message });
      }
      throw error;
    }
  }
}
