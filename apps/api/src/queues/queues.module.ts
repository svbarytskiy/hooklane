import { createWorkflowExecutionQueue } from '@hooklane/queue';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from 'src/config/env.schema';
import { WORKFLOW_EXECUTION_QUEUE_CLIENT } from './queue.tokens';
import { WorkflowExecutionProducer } from './workflow-execution.producer';

@Global()
@Module({
  providers: [
    {
      provide: WORKFLOW_EXECUTION_QUEUE_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        createWorkflowExecutionQueue(config.get('REDIS_URL', { infer: true })),
    },
    WorkflowExecutionProducer,
  ],
  exports: [WorkflowExecutionProducer],
})
export class QueuesModule {}
