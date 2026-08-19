import type { ExecuteWorkflowJob } from "@hooklane/contracts";
import { createWorkflowExecutionWorker } from "@hooklane/queue";
import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { UnrecoverableError, type Job, type Worker } from "bullmq";
import type { WorkerEnv } from "./config/env.schema";
import { WorkerDatabaseService } from "./database/worker-database.service";
import { ExecutionDataSanitizerService } from "./runtime/execution-data-sanitizer.service";
import { toWorkflowExecutionError } from "./runtime/workflow-runtime.error";
import {
  ExecutionCancelledError,
  WorkflowExecutionRunner,
} from "./workflow-execution.runner";

@Injectable()
export class WorkflowExecutionProcessor
  implements OnModuleInit, OnModuleDestroy
{
  private worker?: Worker<ExecuteWorkflowJob>;

  constructor(
    private readonly config: ConfigService<WorkerEnv, true>,
    private readonly database: WorkerDatabaseService,
    private readonly runner: WorkflowExecutionRunner,
    private readonly sanitizer: ExecutionDataSanitizerService,
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
        backoffMaxDelayMs: this.config.get("WORKFLOW_BACKOFF_MAX_DELAY_MS", {
          infer: true,
        }),
        backoffJitterRatio: this.config.get("WORKFLOW_BACKOFF_JITTER_RATIO", {
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
        autorun: false,
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
    void this.worker.run().catch((error) => {
      console.error("[worker] stopped unexpectedly", error);
    });
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
      const stepRecordIds = new Map<string, string>();
      const result = await this.runner.run({
        ...context,
        lifecycle: {
          onStarted: async (step, index) => {
            const id = await this.database.startStep(
              job.data.executionId,
              currentAttemptId,
              step.id,
              index,
              this.sanitizer.stepInput(step),
            );
            stepRecordIds.set(step.id, id);
          },
          onSucceeded: async (step, _index, output) => {
            await this.database.completeStep(
              stepRecordIds.get(step.id)!,
              "succeeded",
              this.sanitizer.redact(output),
            );
          },
          onFailed: async (step, _index, error) => {
            await this.database.completeStep(
              stepRecordIds.get(step.id)!,
              "failed",
              undefined,
              error,
            );
          },
          onSkipped: (step, index) =>
            this.database.skipStep(
              job.data.executionId,
              currentAttemptId,
              step.id,
              index,
              this.sanitizer.stepInput(step),
            ),
        },
        limits: {
          maxSteps: this.config.get("WORKFLOW_MAX_STEPS", { infer: true }),
          maxDurationMs: this.config.get("WORKFLOW_MAX_DURATION_MS", {
            infer: true,
          }),
          stepTimeoutMs: this.config.get("WORKFLOW_STEP_TIMEOUT_MS", {
            infer: true,
          }),
        },
        isCancellationRequested: () =>
          this.database.isExecutionCancelled(job.data.executionId),
      });
      await this.database.completeAttempt(currentAttemptId, "succeeded");
      console.log(
        `[worker] executed execution=${context.executionId} steps=${result.executedSteps}`,
      );
      await this.database.markSucceeded(job.data.executionId);
    } catch (error) {
      const failure = toWorkflowExecutionError(error);
      if (attemptId) {
        await this.database.completeAttempt(attemptId, "failed", failure);
      }
      if (error instanceof ExecutionCancelledError) {
        return;
      }
      const maxAttempts = job.opts.attempts ?? 1;
      const hasRetryLeft = job.attemptsMade + 1 < maxAttempts;
      if (failure.retryable && hasRetryLeft) {
        await this.database.markRetryableFailure(job.data.executionId, failure);
      } else {
        await this.database.markFailed(job.data.executionId, failure);
      }

      if (!failure.retryable) {
        throw new UnrecoverableError(failure.message);
      }
      throw error;
    }
  }
}
