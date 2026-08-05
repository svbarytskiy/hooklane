import { AuthService } from './auth.service';
import type { SupabaseAdminClient } from 'src/supabase/supabase.types';

describe('AuthService', () => {
  it('maps a valid Supabase user to the authenticated user contract', async () => {
    const getUser = jest.fn().mockResolvedValue({
      data: { user: { id: 'user_1', email: 'user@example.com' } },
      error: null,
    });
    const service = new AuthService({
      auth: { getUser },
    } as unknown as SupabaseAdminClient);

    await expect(service.verifyAccessToken('token')).resolves.toEqual({
      id: 'user_1',
      email: 'user@example.com',
    });
    expect(getUser).toHaveBeenCalledWith('token');
  });

  it('rejects an invalid Supabase token', async () => {
    const service = new AuthService({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: null },
          error: new Error('invalid'),
        }),
      },
    } as unknown as SupabaseAdminClient);

    await expect(service.verifyAccessToken('bad-token')).rejects.toThrow(
      'Invalid Supabase access token',
    );
  });
});
