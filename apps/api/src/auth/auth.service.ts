import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { SUPABASE_ADMIN_CLIENT } from 'src/supabase/supabase.tokens';
import type { SupabaseAdminClient } from 'src/supabase/supabase.types';
import { AuthenticatedUser } from './auth.types';

@Injectable()
export class AuthService {
  constructor(
    @Inject(SUPABASE_ADMIN_CLIENT)
    private readonly supabase: SupabaseAdminClient,
  ) {}

  async verifyAccessToken(accessToken: string): Promise<AuthenticatedUser> {
    const { data, error } = await this.supabase.auth.getUser(accessToken);
    if (error || !data.user) {
      throw new UnauthorizedException('Invalid Supabase access token');
    }
    return {
      id: data.user.id,
      email: data.user.email ?? null,
    };
  }
}
