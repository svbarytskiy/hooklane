import type { ExecuteWorkflowJob } from "@hooklane/contracts";
import { Queue, Worker } from "bullmq";
import type { Job } from "bullmq";
import { createBullMqRedisConnection } from "./redis-connection.js";
import {
  EXECUTE_WORKFLOW_JOB,
  WORKFLOW_EXECUTION_QUEUE,
} from "./queue-names.js";

export type WorkflowQueueOptions = {
  attempts?: number;
  backoffDelayMs?: number;
  backoffMaxDelayMs?: number;
  backoffJitterRatio?: number;
  concurrency?: number;
  removeOnComplete?: number;
  removeOnFail?: number;
  autorun?: boolean;
};

const defaults: Required<WorkflowQueueOptions> = {
  attempts: 3,
  backoffDelayMs: 1_000,
  backoffMaxDelayMs: 300_000,
  backoffJitterRatio: 0.2,
  concurrency: 1,
  removeOnComplete: 1_000,
  removeOnFail: 5_000,
  autorun: true,
};

export function createWorkflowExecutionQueue(
  redisUrl: string,
  options: WorkflowQueueOptions = {},
) {
  const config = { ...defaults, ...options };

  return new Queue<ExecuteWorkflowJob>(WORKFLOW_EXECUTION_QUEUE, {
    connection: createBullMqRedisConnection(redisUrl),
    defaultJobOptions: {
      attempts: config.attempts,
      backoff: {
        type: WORKFLOW_BACKOFF_STRATEGY,
        delay: config.backoffDelayMs,
      },
      removeOnComplete: config.removeOnComplete,
      removeOnFail: config.removeOnFail,
    },
  });
}

export function createWorkflowExecutionWorker(
  redisUrl: string,
  processor: (job: Job<ExecuteWorkflowJob>) => Promise<unknown>,
  options: WorkflowQueueOptions = {},
) {
  const config = { ...defaults, ...options };

  return new Worker<ExecuteWorkflowJob>(WORKFLOW_EXECUTION_QUEUE, processor, {
    connection: createBullMqRedisConnection(redisUrl),
    concurrency: config.concurrency,
    autorun: config.autorun,
    settings: {
      backoffStrategy: (attemptsMade, type, error) => {
        if (type !== WORKFLOW_BACKOFF_STRATEGY) {
          throw new Error(`Unknown backoff strategy ${type ?? "undefined"}`);
        }

        return calculateWorkflowBackoff({
          attemptsMade,
          baseDelayMs: config.backoffDelayMs,
          maxDelayMs: config.backoffMaxDelayMs,
          jitterRatio: config.backoffJitterRatio,
          retryAfterMs: readRetryAfterMs(error),
        });
      },
    },
  });
}

export const WORKFLOW_BACKOFF_STRATEGY = "workflow-exponential";

export type WorkflowBackoffInput = {
  attemptsMade: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterRatio: number;
  retryAfterMs?: number;
  random?: () => number;
};

export function calculateWorkflowBackoff({
  attemptsMade,
  baseDelayMs,
  maxDelayMs,
  jitterRatio,
  retryAfterMs,
  random = Math.random,
}: WorkflowBackoffInput): number {
  const exponentialDelay = Math.min(
    maxDelayMs,
    baseDelayMs * 2 ** Math.max(0, attemptsMade - 1),
  );
  const normalizedJitter = Math.min(1, Math.max(0, jitterRatio));
  const jitteredDelay = Math.floor(
    exponentialDelay * (1 - normalizedJitter * random()),
  );
  const providerDelay =
    retryAfterMs === undefined
      ? 0
      : Math.min(maxDelayMs, Math.max(0, retryAfterMs));

  return Math.max(jitteredDelay, providerDelay);
}

function readRetryAfterMs(error?: Error): number | undefined {
  if (!error || !("retryAfterMs" in error)) return undefined;

  const value = (error as Error & { retryAfterMs?: unknown }).retryAfterMs;
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

export { EXECUTE_WORKFLOW_JOB };
