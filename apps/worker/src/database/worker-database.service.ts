import {
  createExecutionRepository,
  type ExecutionContext,
  type ExecutionRepository,
} from "@hooklane/db";
import { Inject, Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { WorkerEnv } from "../config/env.schema";

export const WORKER_POSTGRES_CLIENT = Symbol("WORKER_POSTGRES_CLIENT");

@Injectable()
export class WorkerDatabaseService implements OnModuleDestroy {
  constructor(
    @Inject(WORKER_POSTGRES_CLIENT)
    private readonly repository: ExecutionRepository,
  ) {}

  claimExecution(executionId: string): Promise<boolean> {
    return this.repository.claimExecution(executionId);
  }

  ping(): Promise<void> {
    return this.repository.ping();
  }

  loadExecutionContext(executionId: string): Promise<ExecutionContext> {
    return this.repository.loadExecutionContext(executionId);
  }

  markSucceeded(executionId: string): Promise<void> {
    return this.repository.markSucceeded(executionId);
  }

  markFailed(executionId: string, failure: { message: string }): Promise<void> {
    return this.repository.markFailed(executionId, failure);
  }

  markRetryableFailure(
    executionId: string,
    failure: { message: string },
  ): Promise<void> {
    return this.repository.markRetryableFailure(executionId, failure);
  }

  startAttempt(executionId: string, attemptNumber: number): Promise<string> {
    return this.repository.startAttempt(executionId, attemptNumber);
  }

  completeAttempt(
    attemptId: string,
    status: "succeeded" | "failed",
    error?: { message: string },
  ): Promise<void> {
    return this.repository.completeAttempt(attemptId, status, error);
  }

  recordStep(
    executionId: string,
    attemptId: string,
    stepId: string,
    stepIndex: number,
    status: "succeeded" | "failed",
    output?: unknown,
    error?: { message: string },
  ): Promise<void> {
    return this.repository.recordStep(
      executionId,
      attemptId,
      stepId,
      stepIndex,
      status,
      output,
      error,
    );
  }

  onModuleDestroy(): Promise<void> {
    return this.repository.close();
  }
}

export function createWorkerPostgresClient(
  config: ConfigService<WorkerEnv, true>,
): ExecutionRepository {
  return createExecutionRepository(config.get("DATABASE_URL", { infer: true }));
}
