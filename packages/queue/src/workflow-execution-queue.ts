import type { ExecuteWorkflowJob } from "@hooklane/contracts";
import { Queue, Worker } from "bullmq";
import type { Job } from "bullmq";
import { createBullMqRedisConnection } from "./redis-connection.js";
import {
  EXECUTE_WORKFLOW_JOB,
  WORKFLOW_EXECUTION_QUEUE,
} from "./queue-names.js";

export function createWorkflowExecutionQueue(redisUrl: string) {
  return new Queue<ExecuteWorkflowJob>(WORKFLOW_EXECUTION_QUEUE, {
    connection: createBullMqRedisConnection(redisUrl),
    defaultJobOptions: {
      removeOnComplete: 1000,
      removeOnFail: 5000,
    },
  });
}

export function createWorkflowExecutionWorker(
  redisUrl: string,
  processor: (job: Job<ExecuteWorkflowJob>) => Promise<unknown>,
) {
  return new Worker<ExecuteWorkflowJob>(WORKFLOW_EXECUTION_QUEUE, processor, {
    connection: createBullMqRedisConnection(redisUrl),
    concurrency: 1,
  });
}

export { EXECUTE_WORKFLOW_JOB };
