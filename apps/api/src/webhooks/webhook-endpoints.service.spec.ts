import { ConflictException } from '@nestjs/common';
import { WebhookEndpointsService } from './webhook-endpoints.service';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const workflowId = '22222222-2222-4222-8222-222222222222';
const endpointId = '33333333-3333-4333-8333-333333333333';

const workflow = { id: workflowId, status: 'active' };
const archivedWorkflow = { id: workflowId, status: 'archived' };
const endpoint = {
  id: endpointId,
  workspaceId,
  workflowId,
  name: 'Orders',
  publicId: 'wh_example',
  status: 'active',
  signatureMode: 'hmac_sha256',
  signingSecretCiphertext: 'v1.ciphertext',
  secretLastRotatedAt: new Date('2026-08-09T12:00:00.000Z'),
  createdBy: '44444444-4444-4444-8444-444444444444',
  createdAt: new Date('2026-08-09T11:00:00.000Z'),
  updatedAt: new Date('2026-08-09T12:00:00.000Z'),
};

function selectWithLimit(rows: unknown[]) {
  const limit = jest.fn().mockResolvedValue(rows);
  const where = jest.fn().mockReturnValue({ limit });
  const from = jest.fn().mockReturnValue({ where });

  return { from };
}

function createService(
  db: Record<string, unknown>,
  crypto = {
    generateSecret: jest.fn().mockReturnValue('hlsec_new-secret'),
    encrypt: jest.fn().mockReturnValue('v1.encrypted-secret'),
  },
) {
  const config = {
    get: jest.fn().mockReturnValue('https://api.example.test'),
  };

  return {
    service: new WebhookEndpointsService(
      db as never,
      crypto as never,
      config as never,
    ),
    crypto,
    config,
  };
}

describe('WebhookEndpointsService', () => {
  it('creates an HMAC endpoint by default and never returns its ciphertext', async () => {
    const insertValues = jest.fn().mockReturnValue({
      onConflictDoNothing: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([endpoint]),
      }),
    });
    const tx = {
      select: jest
        .fn()
        .mockReturnValueOnce(selectWithLimit([workflow]))
        .mockReturnValueOnce(selectWithLimit([{ id: 'published-version' }])),
      insert: jest.fn().mockReturnValue({ values: insertValues }),
    };
    const db = {
      transaction: jest.fn((callback: (transaction: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const { service, crypto } = createService(db);

    const result = await service.createWebhookEndpoint(
      'user-id',
      workspaceId,
      workflowId,
      { name: ' Orders ' },
    );

    expect(crypto.generateSecret).toHaveBeenCalledTimes(1);
    expect(crypto.encrypt).toHaveBeenCalledWith('hlsec_new-secret');
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId,
        workflowId,
        name: 'Orders',
        signatureMode: 'hmac_sha256',
        signingSecretCiphertext: 'v1.encrypted-secret',
      }),
    );
    expect(result.signingSecret).toBe('hlsec_new-secret');
    expect(result.endpoint).not.toHaveProperty('signingSecretCiphertext');
  });

  it('does not generate a secret for an explicitly unsigned endpoint', async () => {
    const unsignedEndpoint = { ...endpoint, signatureMode: 'none' };
    const insertValues = jest.fn().mockReturnValue({
      onConflictDoNothing: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([unsignedEndpoint]),
      }),
    });
    const tx = {
      select: jest
        .fn()
        .mockReturnValueOnce(selectWithLimit([workflow]))
        .mockReturnValueOnce(selectWithLimit([{ id: 'published-version' }])),
      insert: jest.fn().mockReturnValue({ values: insertValues }),
    };
    const db = {
      transaction: jest.fn((callback: (transaction: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const { service, crypto } = createService(db);

    const result = await service.createWebhookEndpoint(
      'user-id',
      workspaceId,
      workflowId,
      { name: 'Unsigned', signatureMode: 'none' },
    );

    expect(crypto.generateSecret).not.toHaveBeenCalled();
    expect(crypto.encrypt).not.toHaveBeenCalled();
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        signatureMode: 'none',
        signingSecretCiphertext: null,
      }),
    );
    expect(result.signingSecret).toBeNull();
  });

  it('rejects endpoint creation for an archived workflow', async () => {
    const tx = {
      select: jest.fn().mockReturnValue(selectWithLimit([archivedWorkflow])),
      insert: jest.fn(),
    };
    const db = {
      transaction: jest.fn((callback: (transaction: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const { service } = createService(db);

    await expect(
      service.createWebhookEndpoint('user-id', workspaceId, workflowId, {
        name: 'Orders',
      }),
    ).rejects.toThrow('cannot be created for an archived workflow');
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it('requires a published workflow version before endpoint creation', async () => {
    const tx = {
      select: jest
        .fn()
        .mockReturnValueOnce(selectWithLimit([workflow]))
        .mockReturnValueOnce(selectWithLimit([])),
      insert: jest.fn(),
    };
    const db = {
      transaction: jest.fn((callback: (transaction: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const { service } = createService(db);

    await expect(
      service.createWebhookEndpoint('user-id', workspaceId, workflowId, {
        name: 'Orders',
      }),
    ).rejects.toThrow(
      'Publish the workflow before creating a webhook endpoint',
    );
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it('maps a duplicate endpoint name to ConflictException', async () => {
    const db = {
      transaction: jest.fn().mockRejectedValue({
        cause: {
          code: '23505',
          constraint: 'webhook_endpoints_workflow_name_unique',
        },
      }),
    };
    const { service } = createService(db);

    await expect(
      service.createWebhookEndpoint('user-id', workspaceId, workflowId, {
        name: 'Orders',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('lists only safe endpoint fields', async () => {
    const orderBy = jest.fn().mockResolvedValue([endpoint]);
    const endpointWhere = jest.fn().mockReturnValue({ orderBy });
    const endpointFrom = jest.fn().mockReturnValue({ where: endpointWhere });
    const db = {
      select: jest
        .fn()
        .mockReturnValueOnce(selectWithLimit([workflow]))
        .mockReturnValueOnce({ from: endpointFrom }),
    };
    const { service } = createService(db);

    const result = await service.listWebhookEndpoints(workspaceId, workflowId);

    expect(result).toEqual([
      expect.objectContaining({
        id: endpointId,
        url: 'https://api.example.test/hooks/wh_example',
      }),
    ]);
    expect(result[0]).not.toHaveProperty('signingSecretCiphertext');
    expect(db.select.mock.calls[1][0]).not.toHaveProperty(
      'signingSecretCiphertext',
    );
  });

  it('updates endpoint status within its workspace and workflow', async () => {
    const returning = jest
      .fn()
      .mockResolvedValue([{ ...endpoint, status: 'inactive' }]);
    const where = jest.fn().mockReturnValue({ returning });
    const set = jest.fn().mockReturnValue({ where });
    const db = {
      select: jest.fn().mockReturnValue(selectWithLimit([workflow])),
      update: jest.fn().mockReturnValue({ set }),
    };
    const { service } = createService(db);

    const result = await service.updateWebhookEndpoint(
      workspaceId,
      workflowId,
      endpointId,
      { status: 'inactive' },
    );

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'inactive' }),
    );
    expect(result.status).toBe('inactive');
  });

  it('rotates the secret of an HMAC endpoint without returning ciphertext', async () => {
    const returning = jest.fn().mockResolvedValue([endpoint]);
    const where = jest.fn().mockReturnValue({ returning });
    const set = jest.fn().mockReturnValue({ where });
    const db = {
      select: jest
        .fn()
        .mockReturnValueOnce(selectWithLimit([workflow]))
        .mockReturnValueOnce(selectWithLimit([endpoint])),
      update: jest.fn().mockReturnValue({ set }),
    };
    const { service, crypto } = createService(db);

    const result = await service.rotateWebhookEndpointSecret(
      workspaceId,
      workflowId,
      endpointId,
    );

    expect(crypto.encrypt).toHaveBeenCalledWith('hlsec_new-secret');
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        signingSecretCiphertext: 'v1.encrypted-secret',
      }),
    );
    expect(result.signingSecret).toBe('hlsec_new-secret');
    expect(result.endpoint).not.toHaveProperty('signingSecretCiphertext');
  });

  it('rejects secret rotation for an unsigned endpoint', async () => {
    const db = {
      select: jest
        .fn()
        .mockReturnValueOnce(selectWithLimit([workflow]))
        .mockReturnValueOnce(
          selectWithLimit([{ ...endpoint, signatureMode: 'none' }]),
        ),
      update: jest.fn(),
    };
    const { service } = createService(db);

    await expect(
      service.rotateWebhookEndpointSecret(workspaceId, workflowId, endpointId),
    ).rejects.toThrow('Only HMAC webhook endpoints have a signing secret');
    expect(db.update).not.toHaveBeenCalled();
  });
});
