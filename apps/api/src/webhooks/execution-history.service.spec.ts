import type { ResumeExecutionRequest } from '@hooklane/contracts';
import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  executionOutbox,
  executionRecoveries,
  executions,
} from 'src/database/schema';
import { ExecutionHistoryService } from './execution-history.service';

type QueryChain = PromiseLike<unknown[]> & {
  from: () => QueryChain;
  innerJoin: () => QueryChain;
  leftJoin: () => QueryChain;
  where: () => QueryChain;
  orderBy: () => QueryChain;
  limit: () => Promise<unknown[]>;
};

function queryResult(rows: unknown[]): QueryChain {
  const result = Promise.resolve(rows);
  const chain = {
    from: () => chain,
    innerJoin: () => chain,
    leftJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: () => result,
    then: <TResult1 = unknown[], TResult2 = never>(
      onfulfilled?:
        ((value: unknown[]) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?:
        ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) => result.then(onfulfilled, onrejected),
  } as QueryChain;
  return chain;
}

describe('ExecutionHistoryService recovery operations', () => {
  it('creates replay execution, audit record, and outbox entry atomically', async () => {
    const inserted: Array<{ table: unknown; values: unknown }> = [];
    const tx = {
      insert: jest.fn((table: unknown) => ({
        values: (values: unknown) => {
          inserted.push({ table, values });
          if (table === executionOutbox) return Promise.resolve();
          return {
            returning: () =>
              Promise.resolve([
                table === executions
                  ? { id: 'target-execution' }
                  : { id: 'recovery-id' },
              ]),
          };
        },
      })),
    };
    const db = {
      select: jest.fn(() =>
        queryResult([
          {
            id: 'source-execution',
            workspaceId: 'workspace-id',
            workflowId: 'workflow-id',
            workflowVersionId: 'version-id',
            incomingEventId: 'event-id',
            status: 'failed',
            runSequence: 0,
          },
        ]),
      ),
      transaction: jest.fn(
        async (callback: (transaction: typeof tx) => Promise<unknown>) =>
          callback(tx),
      ),
    };
    const service = new ExecutionHistoryService(db as never, {} as never);

    await expect(
      service.replayAsNew(
        'workspace-id',
        'workflow-id',
        'source-execution',
        'user-id',
      ),
    ).resolves.toEqual({
      recoveryId: 'recovery-id',
      executionId: 'target-execution',
      sourceExecutionId: 'source-execution',
      status: 'pending',
    });

    expect(inserted.map(({ table }) => table)).toEqual([
      executions,
      executionRecoveries,
      executionOutbox,
    ]);
    expect(inserted[0]?.values).toMatchObject({
      incomingEventId: 'event-id',
      workflowVersionId: 'version-id',
      replayedFromExecutionId: 'source-execution',
      status: 'pending',
    });
    expect(inserted[1]?.values).toMatchObject({
      executionId: 'source-execution',
      targetExecutionId: 'target-execution',
      operation: 'replay_as_new',
      requestedBy: 'user-id',
    });
    expect(inserted[2]?.values).toEqual({
      executionId: 'target-execution',
    });
  });

  it('rejects resume when the reconciled output field is absent', async () => {
    const service = new ExecutionHistoryService({} as never, {} as never);

    await expect(
      service.resumeExecution(
        'workspace-id',
        'workflow-id',
        'execution-id',
        'user-id',
        { stepId: 'http-step' } as ResumeExecutionRequest,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a checkpoint containing redacted durable output', async () => {
    const results = [
      [
        {
          id: 'execution-id',
          workspaceId: 'workspace-id',
          workflowId: 'workflow-id',
          workflowVersionId: 'version-id',
          incomingEventId: 'event-id',
          status: 'failed',
          runSequence: 0,
        },
      ],
      [
        {
          attemptId: 'attempt-id',
          stepId: 'failed-step',
          stepIndex: 1,
          error: { code: 'upstream_unavailable' },
        },
      ],
      [
        {
          stepId: 'completed-step',
          input: { type: 'http' },
          output: { accessToken: '[REDACTED]' },
        },
      ],
      [{ checkpoint: null }],
    ];
    const db = {
      select: jest.fn(() => queryResult(results.shift() ?? [])),
    };
    const service = new ExecutionHistoryService(db as never, {} as never);

    await expect(
      service.retryFailedStep(
        'workspace-id',
        'workflow-id',
        'execution-id',
        'user-id',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
