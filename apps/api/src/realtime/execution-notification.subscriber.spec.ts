jest.mock('@hooklane/contracts', () => ({
  EXECUTION_NOTIFICATIONS_CHANNEL: 'hooklane:execution-notifications:v1',
  isExecutionNotificationV1: (value: unknown) =>
    typeof value === 'object' && value !== null && 'version' in value,
}));

import { ExecutionNotificationSubscriber } from './execution-notification.subscriber';

describe('ExecutionNotificationSubscriber', () => {
  it('subscribes through a dedicated Redis connection and forwards valid notifications', async () => {
    const listeners = new Map<string, (...args: never[]) => void>();
    const subscriber = {
      on: jest.fn((event: string, listener: (...args: never[]) => void) => {
        listeners.set(event, listener);
      }),
      off: jest.fn(),
      subscribe: jest.fn().mockResolvedValue(1),
      quit: jest.fn().mockResolvedValue('OK'),
    };
    const redis = { createSubscriber: jest.fn(() => subscriber) };
    const notificationBus = { emit: jest.fn() };
    const service = new ExecutionNotificationSubscriber(
      redis as never,
      notificationBus as never,
    );

    await service.onModuleInit();
    listeners.get('message')?.(
      'hooklane:execution-notifications:v1',
      JSON.stringify({ version: 1, executionId: 'execution-id' }),
    );

    expect(redis.createSubscriber).toHaveBeenCalledTimes(1);
    expect(subscriber.subscribe).toHaveBeenCalledWith(
      'hooklane:execution-notifications:v1',
    );
    expect(notificationBus.emit).toHaveBeenCalledWith({
      version: 1,
      executionId: 'execution-id',
    });
  });
});
