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
  concurrency?: number;
  removeOnComplete?: number;
  removeOnFail?: number;
  autorun?: boolean;
};

const defaults: Required<WorkflowQueueOptions> = {
  attempts: 3,
  backoffDelayMs: 1_000,
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
        type: "exponential",
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
  });
}

export { EXECUTE_WORKFLOW_JOB };
