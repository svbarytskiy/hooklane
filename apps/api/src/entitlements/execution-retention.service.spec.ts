import { ExecutionRetentionService } from './execution-retention.service';

describe('ExecutionRetentionService', () => {
  it('deletes terminal executions in batches until the last partial batch', async () => {
    const execute = jest
      .fn()
      .mockResolvedValueOnce(
        Array.from({ length: 250 }, (_, index) => ({ id: index })),
      )
      .mockResolvedValueOnce([{ id: 251 }]);
    const service = new ExecutionRetentionService(
      { execute } as never,
      { tryAcquire: jest.fn().mockResolvedValue(true) } as never,
    );

    await service.pruneExpiredExecutions();

    expect(execute).toHaveBeenCalledTimes(4);
  });
});
