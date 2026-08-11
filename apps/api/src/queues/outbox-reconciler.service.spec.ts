jest.mock('@hooklane/queue', () => ({
  EXECUTE_WORKFLOW_JOB: 'execute-workflow',
}));

import { OutboxReconcilerService } from './outbox-reconciler.service';

describe('OutboxReconcilerService', () => {
  it('publishes pending entries and marks their execution queued', async () => {
    const whereSelect = jest.fn().mockReturnValue({
      limit: jest.fn().mockResolvedValue([
        {
          outboxId: 'outbox-1',
          executionId: 'execution-1',
          incomingEventId: 'event-1',
          workflowVersionId: 'version-1',
        },
      ]),
    });
    const db = {
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          innerJoin: jest.fn().mockReturnValue({ where: whereSelect }),
        }),
      }),
      update: jest.fn().mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(undefined),
        }),
      }),
    };
    const producer = {
      enqueueExecution: jest.fn().mockResolvedValue('job-1'),
    };
    const service = new OutboxReconcilerService(db as never, producer as never);

    await (
      service as unknown as { reconcile: () => Promise<void> }
    ).reconcile();

    expect(producer.enqueueExecution).toHaveBeenCalledWith({
      executionId: 'execution-1',
      incomingEventId: 'event-1',
      workflowVersionId: 'version-1',
    });
    expect(db.update).toHaveBeenCalledTimes(2);
  });
});
