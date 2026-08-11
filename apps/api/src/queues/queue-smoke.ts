import type { ExecuteWorkflowJob } from '@hooklane/contracts';
import {
  createWorkflowExecutionQueue,
  createWorkflowExecutionWorker,
  EXECUTE_WORKFLOW_JOB,
} from '@hooklane/queue';

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error('REDIS_URL must be set before running queue:smoke');
}

async function main(redisUrl: string) {
  const queue = createWorkflowExecutionQueue(redisUrl);
  const data: ExecuteWorkflowJob = {
    executionId: `smoke-execution-${Date.now()}`,
    incomingEventId: 'smoke-event',
    workflowVersionId: 'smoke-version',
  };
  let processed = false;
  const worker = createWorkflowExecutionWorker(redisUrl, (job) => {
    processed = job.data.executionId === data.executionId;
    return Promise.resolve();
  });

  const job = await queue.add(EXECUTE_WORKFLOW_JOB, data, {
    jobId: data.executionId,
  });

  console.log(`[queue-smoke] enqueued job=${job.id}`);
  const deadline = Date.now() + 10_000;
  while (!processed && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!processed) {
    throw new Error('Worker did not process the smoke job within 10 seconds');
  }
  console.log('[queue-smoke] worker processed job');
  await worker.close();
  await queue.close();
}

void main(redisUrl).catch((error: unknown) => {
  console.error('[queue-smoke] failed', error);
  process.exitCode = 1;
});
