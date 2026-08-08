import { ConflictException } from '@nestjs/common';
import { WorkspacesService } from './workspaces.service';

describe('WorkspacesService', () => {
  const workspace = {
    id: 'workspace-1',
    name: 'Acme',
    slug: 'acme',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('creates a workspace and its owner membership in one transaction', async () => {
    const workspaceInsert = {
      values: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([workspace]),
      }),
    };
    const membershipInsert = {
      values: jest.fn().mockResolvedValue([]),
    };
    const transaction = {
      insert: jest
        .fn()
        .mockReturnValueOnce(workspaceInsert)
        .mockReturnValueOnce(membershipInsert),
    };
    const db = {
      transaction: jest.fn((callback: (tx: typeof transaction) => unknown) =>
        callback(transaction),
      ),
    };
    const service = new WorkspacesService(db as never);

    await expect(
      service.createWorkspace('user-1', 'Acme', 'acme'),
    ).resolves.toEqual({ ...workspace, role: 'owner' });

    expect(membershipInsert.values).toHaveBeenCalledWith({
      workspaceId: workspace.id,
      userId: 'user-1',
      role: 'owner',
    });
  });

  it('maps duplicate slug errors to ConflictException', async () => {
    const db = {
      transaction: jest.fn().mockRejectedValue({ code: '23505' }),
    };
    const service = new WorkspacesService(db as never);

    await expect(
      service.createWorkspace('user-1', 'Acme', 'acme'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns only memberships for the requested user', async () => {
    const rows = [{ ...workspace, role: 'owner' }];
    const orderBy = jest.fn().mockResolvedValue(rows);
    const where = jest.fn().mockReturnValue({ orderBy });
    const innerJoin = jest.fn().mockReturnValue({ where });
    const from = jest.fn().mockReturnValue({ innerJoin });
    const db = {
      select: jest.fn().mockReturnValue({ from }),
    };
    const service = new WorkspacesService(db as never);

    await expect(service.getWorkspaces('user-1')).resolves.toEqual(rows);
    expect(where).toHaveBeenCalledTimes(1);
  });

  it('returns not found when the user is not a workspace member', async () => {
    const limit = jest.fn().mockResolvedValue([]);
    const where = jest.fn().mockReturnValue({ limit });
    const innerJoin = jest.fn().mockReturnValue({ where });
    const from = jest.fn().mockReturnValue({ innerJoin });
    const db = {
      select: jest.fn().mockReturnValue({ from }),
    };
    const service = new WorkspacesService(db as never);

    await expect(service.getWorkspace('user-1', 'workspace-2')).rejects.toThrow(
      'Workspace not found',
    );
  });
});
