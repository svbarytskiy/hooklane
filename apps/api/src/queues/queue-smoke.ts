import type { ExecuteWorkflowJob } from '@hooklane/contracts';
import { createWorkflowExecutionQueue } from '@hooklane/queue';

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

  const job = await queue.add('execute-workflow', data, {
    jobId: data.executionId,
  });

  console.log(`[queue-smoke] enqueued job=${job.id}`);
  await queue.close();
}

void main(redisUrl).catch((error: unknown) => {
  console.error('[queue-smoke] failed', error);
  process.exitCode = 1;
});
