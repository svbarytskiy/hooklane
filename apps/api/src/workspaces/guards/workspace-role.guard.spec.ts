import { ForbiddenException } from '@nestjs/common';
import { WorkspaceRoleGuard } from './workspace-role.guard';

describe('WorkspaceRoleGuard', () => {
  const createContext = (role: string) =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ workspace: { id: 'workspace-1', role } }),
      }),
    }) as never;

  it('allows access when no role requirement is declared', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    };
    const guard = new WorkspaceRoleGuard(reflector as never);

    expect(guard.canActivate(createContext('member'))).toBe(true);
  });

  it.each(['owner', 'admin'])(
    'allows %s to perform workspace mutations',
    (role) => {
      const reflector = {
        getAllAndOverride: jest.fn().mockReturnValue(['owner', 'admin']),
      };
      const guard = new WorkspaceRoleGuard(reflector as never);

      expect(guard.canActivate(createContext(role))).toBe(true);
    },
  );

  it('rejects a member when an owner or admin role is required', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['owner', 'admin']),
    };
    const guard = new WorkspaceRoleGuard(reflector as never);

    expect(() => guard.canActivate(createContext('member'))).toThrow(
      ForbiddenException,
    );
  });
});
