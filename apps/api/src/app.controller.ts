import { Controller, Get, Inject } from '@nestjs/common';
import type { SupabaseAdminClient } from './supabase/supabase.types';
import { SUPABASE_ADMIN_CLIENT } from './supabase/supabase.tokens';

@Controller()
export class AppController {
  constructor(
    @Inject(SUPABASE_ADMIN_CLIENT)
    private readonly supabase: SupabaseAdminClient,
  ) {}

  @Get('health')
  getHealth() {
    return {
      status: 'ok',
    };
  }

  @Get('health/supabase')
  async getSupabaseHealth() {
    const { error } = await this.supabase
      .from('profiles')
      .select('id')
      .limit(1);

    return {
      status: error ? 'error' : 'ok',
      error: error?.message ?? null,
    };
  }
}
