import type { ExecuteWorkflowJob } from '@hooklane/contracts';
import { WorkflowExecutionProducer } from './workflow-execution.producer';

jest.mock('@hooklane/queue', () => ({
  EXECUTE_WORKFLOW_JOB: 'execute-workflow',
}));

describe('WorkflowExecutionProducer', () => {
  it('adds an execution job with a stable id', async () => {
    const queue = {
      add: jest.fn().mockResolvedValue({ id: 'execution:execution-1' }),
      close: jest.fn().mockResolvedValue(undefined),
    };
    const producer = new WorkflowExecutionProducer(queue as never);
    const data: ExecuteWorkflowJob = {
      executionId: 'execution-1',
      incomingEventId: 'event-1',
      workflowVersionId: 'version-1',
    };

    await expect(producer.enqueueExecution(data)).resolves.toBe(
      'execution:execution-1',
    );
    expect(queue.add).toHaveBeenCalledWith('execute-workflow', data, {
      jobId: 'execution:execution-1:run:0',
    });
  });

  it('closes the queue during shutdown', async () => {
    const queue = {
      add: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
    };
    const producer = new WorkflowExecutionProducer(queue as never);

    await producer.onModuleDestroy();

    expect(queue.close).toHaveBeenCalledTimes(1);
  });
});
