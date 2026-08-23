jest.mock('@hooklane/contracts', () => ({
  EXECUTION_NOTIFICATIONS_CHANNEL: 'hooklane:execution-notifications:v1',
}));

import { ExecutionNotificationPublisher } from './execution-notification.publisher';

const EXECUTION_NOTIFICATIONS_CHANNEL = 'hooklane:execution-notifications:v1';

function claimedRows(rows: unknown[]) {
  const result = Promise.resolve(rows);
  const chain = {
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    for: () => chain,
    limit: () => result,
  };
  return chain;
}

describe('ExecutionNotificationPublisher', () => {
  it('claims a pending row, publishes a versioned notification, and marks it published', async () => {
    const entry = {
      id: 'event-id',
      workspaceId: 'workspace-id',
      workflowId: 'workflow-id',
      executionId: 'execution-id',
      sequence: 3,
      eventType: 'execution.step.succeeded',
      data: { stepId: 'http-step', status: 'succeeded' },
      status: 'pending',
      attempts: 0,
      nextAttemptAt: null,
      claimToken: null,
      claimExpiresAt: null,
      lastError: null,
      publishedAt: null,
      createdAt: new Date('2026-08-20T12:00:00.000Z'),
    };
    const claimSet = jest.fn(() => ({
      where: jest.fn().mockResolvedValue([]),
    }));
    const transaction = jest.fn(
      <T>(
        callback: (tx: { select: jest.Mock; update: jest.Mock }) => Promise<T>,
      ): Promise<T> =>
        callback({
          select: jest.fn(() => claimedRows([entry])),
          update: jest.fn(() => ({ set: claimSet })),
        }),
    );
    const publishedSet = jest.fn(() => ({
      where: jest.fn().mockResolvedValue([]),
    }));
    const db = {
      transaction,
      update: jest.fn(() => ({ set: publishedSet })),
    };
    const redis = { publish: jest.fn().mockResolvedValue(1) };
    const publisher = new ExecutionNotificationPublisher(
      db as never,
      redis as never,
    );

    await (
      publisher as unknown as { publishPending(): Promise<void> }
    ).publishPending();

    expect(claimSet).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'processing' }),
    );
    expect(redis.publish).toHaveBeenCalledWith(
      EXECUTION_NOTIFICATIONS_CHANNEL,
      JSON.stringify({
        version: 1,
        eventId: 'event-id',
        type: 'execution.step.succeeded',
        sequence: 3,
        workspaceId: 'workspace-id',
        workflowId: 'workflow-id',
        executionId: 'execution-id',
        occurredAt: '2026-08-20T12:00:00.000Z',
        data: { stepId: 'http-step', status: 'succeeded' },
      }),
    );
    expect(publishedSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'published',
        claimToken: null,
        claimExpiresAt: null,
      }),
    );
  });
});
