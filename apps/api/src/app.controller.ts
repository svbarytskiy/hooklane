import { Controller, Get, Inject } from '@nestjs/common';
import type { SupabaseAdminClient } from './supabase/supabase.types';
import { SUPABASE_ADMIN_CLIENT } from './supabase/supabase.tokens';
import { RedisService } from './redis/redis.service';

@Controller()
export class AppController {
  constructor(
    @Inject(SUPABASE_ADMIN_CLIENT)
    private readonly supabase: SupabaseAdminClient,

    private readonly redis: RedisService,
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

  @Get('health/redis')
  async getRedisHealth() {
    try {
      const response = await this.redis.ping();

      return {
        status: response === 'PONG' ? 'ok' : 'error',
        redis: response,
      };
    } catch {
      return {
        status: 'error',
        redis: 'unavailable',
      };
    }
  }
}
