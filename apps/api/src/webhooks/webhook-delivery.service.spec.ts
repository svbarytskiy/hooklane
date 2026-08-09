import { WebhookDeliveryService } from './webhook-delivery.service';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const workflowId = '22222222-2222-4222-8222-222222222222';

function selectWithLimit(rows: unknown[]) {
  const limit = jest.fn().mockResolvedValue(rows);
  const where = jest.fn().mockReturnValue({ limit });
  const from = jest.fn().mockReturnValue({ where });
  return { from };
}

function historySelectWithLimit(rows: unknown[]) {
  const limit = jest.fn().mockResolvedValue(rows);
  const orderBy = jest.fn().mockReturnValue({ limit });
  const where = jest.fn().mockReturnValue({ orderBy });
  const innerJoin = jest.fn().mockReturnValue({ where });
  const from = jest.fn().mockReturnValue({ innerJoin });
  return { from };
}

function createService(rows: unknown[]) {
  const db = {
    select: jest
      .fn()
      .mockReturnValueOnce(selectWithLimit([{ id: workflowId }]))
      .mockReturnValueOnce(historySelectWithLimit(rows)),
  };
  const config = {
    get: jest
      .fn()
      .mockReturnValueOnce(30)
      .mockReturnValueOnce('password,token,authorization'),
  };

  return new WebhookDeliveryService(db as never, config as never);
}

describe('WebhookDeliveryService', () => {
  it('redacts sensitive nested fields in recent history', async () => {
    const receivedAt = new Date();
    const service = createService([
      {
        eventId: 'event-1',
        executionId: 'execution-1',
        endpointId: 'endpoint-1',
        sourceEventId: 'source-1',
        workflowVersionId: 'version-1',
        eventStatus: 'accepted',
        executionStatus: 'pending',
        payload: {
          email: 'user@example.com',
          token: 'secret-token',
          nested: { password: 'secret-password' },
        },
        payloadSizeBytes: 120,
        receivedAt,
        createdAt: receivedAt,
      },
    ]);

    const [result] = await service.listDeliveries(workspaceId, workflowId);

    expect(result.payload).toEqual({
      email: 'user@example.com',
      token: '[REDACTED]',
      nested: { password: '[REDACTED]' },
    });
  });

  it('hides payloads older than the configured retention period', async () => {
    const receivedAt = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    const service = createService([
      {
        eventId: 'event-1',
        executionId: 'execution-1',
        endpointId: 'endpoint-1',
        sourceEventId: null,
        workflowVersionId: 'version-1',
        eventStatus: 'accepted',
        executionStatus: 'succeeded',
        payload: { orderId: '42' },
        payloadSizeBytes: 20,
        receivedAt,
        createdAt: receivedAt,
      },
    ]);

    const [result] = await service.listDeliveries(workspaceId, workflowId);

    expect(result.payload).toEqual({
      _redacted: true,
      reason: 'retention_policy',
    });
  });
});
