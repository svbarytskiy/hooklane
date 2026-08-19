/// <reference types="jest" />

import type { ExecuteWorkflowJob } from "@hooklane/contracts";

const workerState = {
  processor: undefined as
    | ((job: {
        data: ExecuteWorkflowJob;
        attemptsMade: number;
        opts?: { attempts?: number };
        id?: string;
      }) => Promise<void>)
    | undefined,
  close: jest.fn().mockResolvedValue(undefined),
  waitUntilReady: jest.fn().mockResolvedValue(undefined),
  run: jest.fn().mockResolvedValue(undefined),
  on: jest.fn(),
};

jest.mock("@hooklane/queue", () => ({
  createWorkflowExecutionWorker: jest.fn((_redisUrl, processor) => {
    workerState.processor = processor;
    return workerState;
  }),
}));

jest.mock("@hooklane/db", () => ({
  createExecutionRepository: jest.fn(),
}));

import { ConfigService } from "@nestjs/config";
import { WorkflowExecutionProcessor } from "./workflow-execution.processor";
import { WorkflowRuntimeError } from "./runtime/workflow-runtime.error";

function createConfig() {
  return new ConfigService({
    REDIS_URL: "redis://127.0.0.1:6380",
    WORKFLOW_MAX_ATTEMPTS: 3,
    WORKFLOW_BACKOFF_DELAY_MS: 1000,
    WORKFLOW_BACKOFF_MAX_DELAY_MS: 300000,
    WORKFLOW_BACKOFF_JITTER_RATIO: 0.2,
    WORKFLOW_QUEUE_CONCURRENCY: 1,
    WORKFLOW_COMPLETED_RETENTION: 1000,
    WORKFLOW_FAILED_RETENTION: 5000,
  });
}

describe("WorkflowExecutionProcessor", () => {
  afterEach(() => {
    jest.clearAllMocks();
    workerState.processor = undefined;
  });

  it("starts the worker only after Redis and PostgreSQL are ready", async () => {
    const database = {
      ping: jest.fn().mockResolvedValue(undefined),
    };
    const processor = new WorkflowExecutionProcessor(
      createConfig() as never,
      database as never,
      {} as never,
      {} as never,
    );

    await processor.onModuleInit();

    expect(workerState.waitUntilReady).toHaveBeenCalled();
    expect(database.ping).toHaveBeenCalled();
    expect(workerState.run).toHaveBeenCalled();
    await processor.onModuleDestroy();
    expect(workerState.close).toHaveBeenCalled();
  });

  it("records a successful execution through the runner", async () => {
    const database = {
      ping: jest.fn().mockResolvedValue(undefined),
      claimExecution: jest.fn().mockResolvedValue(true),
      startAttempt: jest.fn().mockResolvedValue("attempt-1"),
      loadExecutionContext: jest.fn().mockResolvedValue({
        executionId: "execution-1",
        payload: {},
        definition: { steps: [] },
      }),
      completeAttempt: jest.fn().mockResolvedValue(undefined),
      recordStep: jest.fn().mockResolvedValue(undefined),
      markSucceeded: jest.fn().mockResolvedValue(undefined),
    };
    const runner = {
      run: jest.fn().mockResolvedValue({ output: {}, executedSteps: 0 }),
    };
    const processor = new WorkflowExecutionProcessor(
      createConfig() as never,
      database as never,
      runner as never,
      { stepInput: jest.fn((step) => step.config) } as never,
    );

    await processor.onModuleInit();
    await workerState.processor?.({
      id: "job-1",
      attemptsMade: 0,
      opts: { attempts: 3 },
      data: {
        executionId: "execution-1",
        incomingEventId: "event-1",
        workflowVersionId: "version-1",
      },
    });

    expect(database.startAttempt).toHaveBeenCalledWith("execution-1", 1);
    expect(database.completeAttempt).toHaveBeenCalledWith(
      "attempt-1",
      "succeeded",
    );
    expect(database.markSucceeded).toHaveBeenCalledWith("execution-1");
  });

  it("requeues retryable failures while BullMQ attempts remain", async () => {
    const database = {
      ping: jest.fn().mockResolvedValue(undefined),
      claimExecution: jest.fn().mockResolvedValue(true),
      startAttempt: jest.fn().mockResolvedValue("attempt-1"),
      loadExecutionContext: jest.fn().mockResolvedValue({
        executionId: "execution-1",
        payload: {},
        definition: { steps: [] },
      }),
      completeAttempt: jest.fn().mockResolvedValue(undefined),
      markRetryableFailure: jest.fn().mockResolvedValue(undefined),
      markFailed: jest.fn().mockResolvedValue(undefined),
    };
    const error = new WorkflowRuntimeError({
      code: "http_upstream_error",
      category: "upstream",
      message: "Provider unavailable",
      httpStatus: 503,
    });
    const runner = { run: jest.fn().mockRejectedValue(error) };
    const processor = new WorkflowExecutionProcessor(
      createConfig() as never,
      database as never,
      runner as never,
      {} as never,
    );

    await processor.onModuleInit();
    const processing = workerState.processor?.({
      id: "job-1",
      attemptsMade: 0,
      opts: { attempts: 3 },
      data: {
        executionId: "execution-1",
        incomingEventId: "event-1",
        workflowVersionId: "version-1",
      },
    });

    await expect(processing).rejects.toBe(error);
    expect(database.markRetryableFailure).toHaveBeenCalledWith(
      "execution-1",
      expect.objectContaining({ retryable: true, httpStatus: 503 }),
    );
    expect(database.markFailed).not.toHaveBeenCalled();
  });

  it("fails terminal errors immediately without consuming more attempts", async () => {
    const database = {
      ping: jest.fn().mockResolvedValue(undefined),
      claimExecution: jest.fn().mockResolvedValue(true),
      startAttempt: jest.fn().mockResolvedValue("attempt-1"),
      loadExecutionContext: jest.fn().mockResolvedValue({
        executionId: "execution-1",
        payload: {},
        definition: { steps: [] },
      }),
      completeAttempt: jest.fn().mockResolvedValue(undefined),
      markRetryableFailure: jest.fn().mockResolvedValue(undefined),
      markFailed: jest.fn().mockResolvedValue(undefined),
    };
    const runner = {
      run: jest.fn().mockRejectedValue(
        new WorkflowRuntimeError({
          code: "http_authentication_failed",
          category: "authentication",
          message: "Unauthorized",
          retryable: false,
          httpStatus: 401,
        }),
      ),
    };
    const processor = new WorkflowExecutionProcessor(
      createConfig() as never,
      database as never,
      runner as never,
      {} as never,
    );

    await processor.onModuleInit();
    const processing = workerState.processor?.({
      id: "job-1",
      attemptsMade: 0,
      opts: { attempts: 3 },
      data: {
        executionId: "execution-1",
        incomingEventId: "event-1",
        workflowVersionId: "version-1",
      },
    });

    await expect(processing).rejects.toMatchObject({
      name: "UnrecoverableError",
    });
    expect(database.markFailed).toHaveBeenCalledWith(
      "execution-1",
      expect.objectContaining({ retryable: false, httpStatus: 401 }),
    );
    expect(database.markRetryableFailure).not.toHaveBeenCalled();
  });
});
