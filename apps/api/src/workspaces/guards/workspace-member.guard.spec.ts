import { NotFoundException } from '@nestjs/common';
import { WorkspaceMemberGuard } from './workspace-member.guard';

describe('WorkspaceMemberGuard', () => {
  const createContext = (request: Record<string, unknown>) =>
    ({
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    }) as never;

  it('attaches the membership context to the request', async () => {
    const request = {
      user: { id: 'user-1' },
      params: { workspaceId: '00000000-0000-4000-8000-000000000001' },
    };
    const service = {
      getMembership: jest.fn().mockResolvedValue({
        id: '00000000-0000-4000-8000-000000000001',
        role: 'owner',
      }),
    };
    const guard = new WorkspaceMemberGuard(service as never);

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
    expect(service.getMembership).toHaveBeenCalledWith(
      'user-1',
      '00000000-0000-4000-8000-000000000001',
    );
    expect(request.workspace).toEqual({
      id: '00000000-0000-4000-8000-000000000001',
      role: 'owner',
    });
  });

  it('supports the legacy id route parameter', async () => {
    const request = {
      user: { id: 'user-1' },
      params: { id: '00000000-0000-4000-8000-000000000001' },
    };
    const service = {
      getMembership: jest.fn().mockResolvedValue({
        id: '00000000-0000-4000-8000-000000000001',
        role: 'member',
      }),
    };
    const guard = new WorkspaceMemberGuard(service as never);

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
    expect(service.getMembership).toHaveBeenCalledWith(
      'user-1',
      '00000000-0000-4000-8000-000000000001',
    );
  });

  it('propagates not-found for users outside the workspace', async () => {
    const request = {
      user: { id: 'user-1' },
      params: { workspaceId: '00000000-0000-4000-8000-000000000002' },
    };
    const service = {
      getMembership: jest
        .fn()
        .mockRejectedValue(new NotFoundException('Workspace not found')),
    };
    const guard = new WorkspaceMemberGuard(service as never);

    await expect(guard.canActivate(createContext(request))).rejects.toThrow(
      'Workspace not found',
    );
  });

  it('rejects malformed workspace ids before querying the database', async () => {
    const request = {
      user: { id: 'user-1' },
      params: { workspaceId: 'not-a-uuid' },
    };
    const service = { getMembership: jest.fn() };
    const guard = new WorkspaceMemberGuard(service as never);

    await expect(guard.canActivate(createContext(request))).rejects.toThrow(
      'Workspace id must be a valid UUID',
    );
    expect(service.getMembership).not.toHaveBeenCalled();
  });
});
