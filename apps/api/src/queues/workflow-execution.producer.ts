import type { ExecuteWorkflowJob } from '@hooklane/contracts';
import { EXECUTE_WORKFLOW_JOB } from '@hooklane/queue';
import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { WORKFLOW_EXECUTION_QUEUE_CLIENT } from './queue.tokens';

@Injectable()
export class WorkflowExecutionProducer implements OnModuleDestroy {
  constructor(
    @Inject(WORKFLOW_EXECUTION_QUEUE_CLIENT)
    private readonly queue: Queue<ExecuteWorkflowJob>,
  ) {}

  async enqueueExecution(data: ExecuteWorkflowJob): Promise<string> {
    const job = await this.queue.add(EXECUTE_WORKFLOW_JOB, data, {
      jobId: `execution:${data.executionId}:run:${data.runSequence ?? 0}`,
    });

    return job.id as string;
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}
