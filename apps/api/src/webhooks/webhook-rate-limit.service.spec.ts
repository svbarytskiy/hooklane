import { HttpException, HttpStatus } from '@nestjs/common';
import { WebhookRateLimitService } from './webhook-rate-limit.service';

function createService(result: { allowed: boolean; remaining: number }) {
  const redis = {
    consumeFixedWindow: jest.fn().mockResolvedValue(result),
  };
  const config = {
    get: jest.fn().mockReturnValueOnce(60).mockReturnValueOnce(60),
  };

  return {
    service: new WebhookRateLimitService(redis as never, config as never),
    redis,
  };
}

describe('WebhookRateLimitService', () => {
  it('allows a request and records the endpoint/IP window', async () => {
    const { service, redis } = createService({ allowed: true, remaining: 59 });

    await expect(
      service.assertAllowed('wh_public', '203.0.113.4'),
    ).resolves.toBeUndefined();
    expect(redis.consumeFixedWindow).toHaveBeenCalledWith(
      'webhook:rate-limit:wh_public:203.0.113.4',
      60,
      60,
    );
  });

  it('rejects requests after the window limit is reached', async () => {
    const { service } = createService({ allowed: false, remaining: 0 });

    await expect(
      service.assertAllowed('wh_public', '203.0.113.4'),
    ).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    } as Partial<HttpException>);
  });
});
