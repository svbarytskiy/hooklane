import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
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

  @Get('health/ready')
  async getReadiness() {
    const [supabaseCheck, redisCheck] = await Promise.all([
      this.checkSupabase(),
      this.checkRedis(),
    ]);

    const checks = {
      supabase: supabaseCheck,
      redis: redisCheck,
    };
    const isReady = Object.values(checks).every(
      (check) => check.status === 'ok',
    );

    if (!isReady) {
      throw new ServiceUnavailableException({
        status: 'error',
        checks,
      });
    }

    return {
      status: 'ok',
      checks,
    };
  }

  private async checkSupabase(): Promise<{ status: 'ok' | 'error' }> {
    try {
      const { error } = await this.supabase
        .from('profiles')
        .select('id')
        .limit(1);

      return { status: error ? 'error' : 'ok' };
    } catch {
      return { status: 'error' };
    }
  }

  private async checkRedis(): Promise<{ status: 'ok' | 'error' }> {
    try {
      const response = await this.redis.ping();

      return { status: response === 'PONG' ? 'ok' : 'error' };
    } catch {
      return { status: 'error' };
    }
  }
}
