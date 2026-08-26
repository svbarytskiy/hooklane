import { InternalServerErrorException } from '@nestjs/common';
import { WorkspaceEntitlementsService } from './workspace-entitlements.service';

const workspaceId = '00000000-0000-4000-8000-000000000001';

function createService(result: unknown[]) {
  const limit = jest.fn().mockResolvedValue(result);
  const where = jest.fn().mockReturnValue({ limit });
  const innerJoin = jest.fn();
  const from = jest.fn();
  const select = jest.fn();
  innerJoin.mockReturnValue({ innerJoin, where });
  from.mockReturnValue({ innerJoin });
  select.mockReturnValue({ from });
  const database = { select };

  return {
    service: new WorkspaceEntitlementsService(database as never),
    select,
  };
}

describe('WorkspaceEntitlementsService', () => {
  it('maps the effective plan and its limits for a workspace', async () => {
    const { service } = createService([
      {
        workspaceId,
        billingOwnerUserId: '00000000-0000-4000-8000-000000000002',
        planCode: 'free',
        planVersion: 1,
        planName: 'Free',
        maxPublishedWorkflows: 3,
        maxIntegrations: 1,
        maxExecutionsPerPeriod: 100,
        maxConcurrentExecutions: 1,
        executionRetentionDays: 7,
        source: 'free',
        status: 'active',
        currentPeriodStart: null,
        currentPeriodEnd: null,
        graceEndsAt: null,
      },
    ]);

    await expect(service.getEffectiveEntitlement(workspaceId)).resolves.toEqual(
      {
        workspaceId,
        billingOwnerUserId: '00000000-0000-4000-8000-000000000002',
        plan: {
          code: 'free',
          version: 1,
          name: 'Free',
          limits: {
            maxPublishedWorkflows: 3,
            maxIntegrations: 1,
            maxExecutionsPerPeriod: 100,
            maxConcurrentExecutions: 1,
            executionRetentionDays: 7,
          },
        },
        source: 'free',
        status: 'active',
        currentPeriodStart: null,
        currentPeriodEnd: null,
        graceEndsAt: null,
      },
    );
  });

  it('fails closed when the workspace invariant is missing', async () => {
    const { service } = createService([]);

    await expect(service.getEffectiveEntitlement(workspaceId)).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
