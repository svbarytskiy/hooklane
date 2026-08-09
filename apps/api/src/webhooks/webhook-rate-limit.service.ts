import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from 'src/config/env.schema';
import { RedisService } from 'src/redis/redis.service';

@Injectable()
export class WebhookRateLimitService {
  private readonly maxRequests: number;
  private readonly windowSeconds: number;

  constructor(
    private readonly redis: RedisService,
    config: ConfigService<Env, true>,
  ) {
    this.maxRequests = config.get('WEBHOOK_RATE_LIMIT_MAX_REQUESTS', {
      infer: true,
    });
    this.windowSeconds = config.get('WEBHOOK_RATE_LIMIT_WINDOW_SECONDS', {
      infer: true,
    });
  }

  async assertAllowed(endpointId: string, clientIp: string): Promise<void> {
    const key = `webhook:rate-limit:${endpointId}:${clientIp}`;
    const result = await this.redis.consumeFixedWindow(
      key,
      this.maxRequests,
      this.windowSeconds,
    );

    if (!result.allowed) {
      throw new HttpException(
        'Webhook rate limit exceeded; retry later',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
