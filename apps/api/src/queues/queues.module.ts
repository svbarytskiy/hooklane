import { createWorkflowExecutionQueue } from '@hooklane/queue';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseModule } from 'src/database/database.module';
import type { Env } from 'src/config/env.schema';
import { WORKFLOW_EXECUTION_QUEUE_CLIENT } from './queue.tokens';
import { WorkflowExecutionProducer } from './workflow-execution.producer';
import { OutboxReconcilerService } from './outbox-reconciler.service';

@Global()
@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: WORKFLOW_EXECUTION_QUEUE_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        createWorkflowExecutionQueue(config.get('REDIS_URL', { infer: true }), {
          attempts: config.get('WORKFLOW_MAX_ATTEMPTS', { infer: true }),
          backoffDelayMs: config.get('WORKFLOW_BACKOFF_DELAY_MS', {
            infer: true,
          }),
          concurrency: config.get('WORKFLOW_QUEUE_CONCURRENCY', {
            infer: true,
          }),
          removeOnComplete: config.get('WORKFLOW_COMPLETED_RETENTION', {
            infer: true,
          }),
          removeOnFail: config.get('WORKFLOW_FAILED_RETENTION', {
            infer: true,
          }),
        }),
    },
    WorkflowExecutionProducer,
    OutboxReconcilerService,
  ],
  exports: [WorkflowExecutionProducer, WORKFLOW_EXECUTION_QUEUE_CLIENT],
})
export class QueuesModule {}
