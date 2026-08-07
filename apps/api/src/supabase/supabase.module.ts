import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import type { Env } from '../config/env.schema';
import { SUPABASE_ADMIN_CLIENT } from './supabase.tokens';
import type { SupabaseAdminClient } from './supabase.types';

@Module({
  providers: [
    {
      provide: SUPABASE_ADMIN_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): SupabaseAdminClient => {
        const supabaseUrl = config.get('SUPABASE_URL', { infer: true });
        const serviceRoleKey = config.get('SUPABASE_SERVICE_ROLE_KEY', {
          infer: true,
        });

        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return createClient(supabaseUrl, serviceRoleKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        });
      },
    },
  ],
  exports: [SUPABASE_ADMIN_CLIENT],
})
export class SupabaseModule {}
