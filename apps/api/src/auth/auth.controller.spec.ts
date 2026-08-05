import { AuthController } from './auth.controller';
import type { AuthenticatedUser } from './auth.types';

describe('AuthController', () => {
  it('returns the authenticated user supplied by the guard', () => {
    const controller = new AuthController();
    const user: AuthenticatedUser = { id: 'user_1', email: 'user@example.com' };

    expect(controller.getMe(user)).toEqual(user);
  });
});
