import {
  BadRequestException,
  ConflictException,
  GoneException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';

jest.mock('@hooklane/queue', () => ({
  EXECUTE_WORKFLOW_JOB: 'execute-workflow',
}));

import { WebhookIngressService } from './webhook-ingress.service';

const endpoint = {
  id: 'endpoint-1',
  workspaceId: 'workspace-1',
  workflowId: 'workflow-1',
  workflowStatus: 'active',
  status: 'active',
  signatureMode: 'hmac_sha256',
  signingSecretCiphertext: 'v1.encrypted',
};
const publishedVersion = { id: 'version-3' };
const payload = { type: 'order.created', orderId: '42' };
const rawBody = Buffer.from(JSON.stringify(payload));

function selectWithLimit(rows: unknown[]) {
  const limit = jest.fn().mockResolvedValue(rows);
  const where = jest.fn().mockReturnValue({ limit });
  const from = jest.fn().mockReturnValue({ where });

  return { from };
}

function selectWithOrder(rows: unknown[]) {
  const limit = jest.fn().mockResolvedValue(rows);
  const orderBy = jest.fn().mockReturnValue({ limit });
  const where = jest.fn().mockReturnValue({ orderBy });
  const from = jest.fn().mockReturnValue({ where });

  return { from };
}

function selectWithJoinLimit(rows: unknown[]) {
  const limit = jest.fn().mockResolvedValue(rows);
  const where = jest.fn().mockReturnValue({ limit });
  const innerJoin = jest.fn().mockReturnValue({ where });
  const from = jest.fn().mockReturnValue({ innerJoin });

  return { from };
}

function insertReturning(rows: unknown[]) {
  const returning = jest.fn().mockResolvedValue(rows);
  const onConflictDoNothing = jest.fn().mockReturnValue({ returning });
  const values = jest.fn().mockReturnValue({ onConflictDoNothing, returning });

  return { values };
}

function createService(
  db: Record<string, unknown>,
  endpointOverrides: Record<string, unknown> = {},
) {
  const crypto = {
    decrypt: jest.fn().mockReturnValue('hlsec_test-secret'),
  };
  const signature = {
    verify: jest.fn(),
  };
  const executionProducer = {
    enqueueExecution: jest.fn().mockResolvedValue('execution-1'),
  };
  const workspaceQuota = {
    reserveExecution: jest.fn().mockResolvedValue(undefined),
  };
  const database = {
    ...db,
    update: jest.fn().mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([]),
      }),
    }),
  };

  return {
    service: new WebhookIngressService(
      database as never,
      crypto as never,
      signature as never,
      executionProducer as never,
      workspaceQuota as never,
    ),
    crypto,
    signature,
    executionProducer,
    workspaceQuota,
    endpoint: { ...endpoint, ...endpointOverrides },
  };
}

function input(overrides: Record<string, unknown> = {}) {
  return {
    publicId: 'wh_orders',
    rawBody,
    payload,
    contentType: 'application/json; charset=utf-8',
    sourceEventId: 'order-event-42',
    timestampHeader: '1700000000',
    signatureHeader: 'v1=signature',
    ...overrides,
  };
}

describe('WebhookIngressService', () => {
  it('stores an accepted event and creates one pending execution transactionally', async () => {
    const eventInsert = insertReturning([{ id: 'event-1' }]);
    const executionInsert = insertReturning([{ id: 'execution-1' }]);
    const outboxInsert = { values: jest.fn().mockResolvedValue(undefined) };
    const tx = {
      select: jest
        .fn()
        .mockReturnValueOnce(selectWithJoinLimit([endpoint]))
        .mockReturnValueOnce(selectWithOrder([publishedVersion])),
      insert: jest
        .fn()
        .mockReturnValueOnce(eventInsert)
        .mockReturnValueOnce(executionInsert)
        .mockReturnValueOnce(outboxInsert),
    };
    const db = {
      transaction: jest.fn((callback: (transaction: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const { service, crypto, signature } = createService(db);

    await expect(service.acceptWebhook(input())).resolves.toEqual({
      eventId: 'event-1',
      executionId: 'execution-1',
      status: 'accepted',
      duplicate: false,
    });

    expect(crypto.decrypt).toHaveBeenCalledWith('v1.encrypted');
    expect(signature.verify).toHaveBeenCalledWith(
      'hlsec_test-secret',
      rawBody,
      '1700000000',
      'v1=signature',
    );
    expect(eventInsert.values).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceEventId: 'order-event-42',
        workflowVersionId: 'version-3',
        payloadSizeBytes: rawBody.length,
      }),
    );
    const eventValues = eventInsert.values.mock.calls[0]?.[0] as {
      payloadSha256: string;
    };
    expect(eventValues.payloadSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(executionInsert.values).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      workflowId: 'workflow-1',
      workflowVersionId: 'version-3',
      incomingEventId: 'event-1',
      runSequence: 0,
      status: 'pending',
    });
  });

  it('returns the existing receipt for a duplicate event ID', async () => {
    const eventInsert = insertReturning([]);
    const tx = {
      select: jest.fn(),
      insert: jest.fn().mockReturnValue(eventInsert),
    };
    const db = {
      transaction: jest.fn((callback: (transaction: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const { service } = createService(db);
    const eventHash = createHashForTest();
    tx.select
      .mockReturnValueOnce(selectWithJoinLimit([endpoint]))
      .mockReturnValueOnce(selectWithOrder([publishedVersion]))
      .mockReturnValueOnce(
        selectWithLimit([{ id: 'event-1', payloadSha256: eventHash }]),
      )
      .mockReturnValueOnce(selectWithLimit([{ id: 'execution-1' }]));

    await expect(service.acceptWebhook(input())).resolves.toEqual({
      eventId: 'event-1',
      executionId: 'execution-1',
      status: 'accepted',
      duplicate: true,
    });
  });

  it('rejects reusing an event ID for a different payload', async () => {
    const tx = {
      select: jest
        .fn()
        .mockReturnValueOnce(selectWithJoinLimit([endpoint]))
        .mockReturnValueOnce(selectWithOrder([publishedVersion]))
        .mockReturnValueOnce(
          selectWithLimit([{ id: 'event-1', payloadSha256: 'different-hash' }]),
        ),
      insert: jest.fn().mockReturnValue(insertReturning([])),
    };
    const db = {
      transaction: jest.fn((callback: (transaction: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const { service } = createService(db);

    await expect(service.acceptWebhook(input())).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('rejects inactive endpoints before processing the payload', async () => {
    const tx = {
      select: jest
        .fn()
        .mockReturnValue(
          selectWithJoinLimit([{ ...endpoint, status: 'inactive' }]),
        ),
      insert: jest.fn(),
    };
    const db = {
      transaction: jest.fn((callback: (transaction: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const { service, signature } = createService(db);

    await expect(service.acceptWebhook(input())).rejects.toBeInstanceOf(
      GoneException,
    );
    expect(signature.verify).not.toHaveBeenCalled();
  });

  it('rejects an endpoint whose workflow was archived', async () => {
    const tx = {
      select: jest
        .fn()
        .mockReturnValue(
          selectWithJoinLimit([{ ...endpoint, workflowStatus: 'archived' }]),
        ),
      insert: jest.fn(),
    };
    const db = {
      transaction: jest.fn((callback: (transaction: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const { service, signature } = createService(db);

    await expect(service.acceptWebhook(input())).rejects.toThrow(
      'Webhook workflow is archived',
    );
    expect(signature.verify).not.toHaveBeenCalled();
  });

  it('requires a published workflow version', async () => {
    const tx = {
      select: jest
        .fn()
        .mockReturnValueOnce(selectWithJoinLimit([endpoint]))
        .mockReturnValueOnce(selectWithOrder([])),
      insert: jest.fn(),
    };
    const db = {
      transaction: jest.fn((callback: (transaction: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const { service } = createService(db);

    await expect(service.acceptWebhook(input())).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('requires signature headers for HMAC endpoints', async () => {
    const tx = {
      select: jest.fn().mockReturnValue(selectWithJoinLimit([endpoint])),
      insert: jest.fn(),
    };
    const db = {
      transaction: jest.fn((callback: (transaction: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const { service } = createService(db);

    await expect(
      service.acceptWebhook(
        input({ timestampHeader: undefined, signatureHeader: undefined }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not verify signatures for explicitly unsigned endpoints', async () => {
    const eventInsert = insertReturning([{ id: 'event-1' }]);
    const executionInsert = insertReturning([{ id: 'execution-1' }]);
    const outboxInsert = { values: jest.fn().mockResolvedValue(undefined) };
    const tx = {
      select: jest
        .fn()
        .mockReturnValueOnce(
          selectWithJoinLimit([
            {
              ...endpoint,
              signatureMode: 'none',
              signingSecretCiphertext: null,
            },
          ]),
        )
        .mockReturnValueOnce(selectWithOrder([publishedVersion])),
      insert: jest
        .fn()
        .mockReturnValueOnce(eventInsert)
        .mockReturnValueOnce(executionInsert)
        .mockReturnValueOnce(outboxInsert),
    };
    const db = {
      transaction: jest.fn((callback: (transaction: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const { service, crypto, signature } = createService(db);

    await expect(service.acceptWebhook(input())).resolves.toMatchObject({
      duplicate: false,
    });
    expect(crypto.decrypt).not.toHaveBeenCalled();
    expect(signature.verify).not.toHaveBeenCalled();
  });
});

function createHashForTest(): string {
  return createHash('sha256').update(rawBody).digest('hex');
}
