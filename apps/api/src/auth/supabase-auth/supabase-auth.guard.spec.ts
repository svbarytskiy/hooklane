import { UnauthorizedException } from '@nestjs/common';
import { SupabaseAuthGuard } from './supabase-auth.guard';
import type { AuthenticatedUser } from '../auth.types';

describe('SupabaseAuthGuard', () => {
  it('verifies a bearer token and attaches the user to the request', async () => {
    const user: AuthenticatedUser = { id: 'user_1', email: 'user@example.com' };
    const authService = {
      verifyAccessToken: jest.fn().mockResolvedValue(user),
    };
    const request = {
      header: jest.fn().mockReturnValue('Bearer access-token'),
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    };
    const guard = new SupabaseAuthGuard(authService as never);

    await expect(guard.canActivate(context as never)).resolves.toBe(true);
    expect(authService.verifyAccessToken).toHaveBeenCalledWith('access-token');
    expect(request).toHaveProperty('user', user);
  });

  it('rejects a request without an authorization header', async () => {
    const guard = new SupabaseAuthGuard({
      verifyAccessToken: jest.fn(),
    } as never);
    const context = {
      switchToHttp: () => ({ getRequest: () => ({ header: () => undefined }) }),
    };

    await expect(guard.canActivate(context as never)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
