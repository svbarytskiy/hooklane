import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { Env } from 'src/config/env.schema';
import { REDIS_CLIENT } from './redis.tokens';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): Redis =>
        new Redis(config.get('REDIS_URL', { infer: true }), {
          maxRetriesPerRequest: 3,
          enableReadyCheck: true,
        }),
    },
    RedisService,
  ],
  exports: [REDIS_CLIENT, RedisService],
})
export class RedisModule {}
