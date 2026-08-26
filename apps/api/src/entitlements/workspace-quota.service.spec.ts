import {
  ForbiddenException,
  HttpException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { WorkspaceQuotaService } from './workspace-quota.service';

function createExecutor(result: unknown) {
  return {
    execute: jest.fn().mockResolvedValue([{ result }]),
  };
}

describe('WorkspaceQuotaService', () => {
  const service = new WorkspaceQuotaService();

  it('accepts a successfully reserved execution', async () => {
    const executor = createExecutor('reserved');

    await expect(
      service.reserveExecution(
        executor as never,
        'workspace-id',
        'execution-id',
      ),
    ).resolves.toBeUndefined();
    expect(executor.execute).toHaveBeenCalledTimes(1);
  });

  it('maps an exhausted execution allowance to a retryable client response', async () => {
    await expect(
      service.reserveExecution(
        createExecutor('execution_limit_exceeded') as never,
        'workspace-id',
        'execution-id',
      ),
    ).rejects.toBeInstanceOf(HttpException);
  });

  it('does not allow a suspended entitlement to consume resources', async () => {
    await expect(
      service.assertCanPublishWorkflow(
        createExecutor('entitlement_inactive') as never,
        'workspace-id',
        'workflow-id',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('fails closed when the database function returns an unexpected result', async () => {
    await expect(
      service.assertCanActivateIntegration(
        createExecutor(null) as never,
        'workspace-id',
        'slack',
        'account-id',
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
