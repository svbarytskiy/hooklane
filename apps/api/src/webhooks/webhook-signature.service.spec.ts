import { UnauthorizedException } from '@nestjs/common';
import { WebhookSignatureService } from './webhook-signature.service';

function createService(toleranceSeconds = 300) {
  const config = {
    get: jest.fn().mockReturnValue(toleranceSeconds),
  };

  return new WebhookSignatureService(config as never);
}

describe('WebhookSignatureService', () => {
  const secret = 'hlsec_test-secret';
  const body = Buffer.from('{"type":"order.created","id":"42"}');
  const nowMs = 1_700_000_000_000;
  const timestamp = Math.floor(nowMs / 1000);

  it('creates and verifies a signature for the exact raw body', () => {
    const service = createService();
    const signature = service.createSignature(secret, timestamp, body);

    expect(signature).toMatch(/^v1=[a-f0-9]{64}$/);
    expect(() =>
      service.verify(secret, body, String(timestamp), signature, nowMs),
    ).not.toThrow();
  });

  it('rejects a body changed after signing', () => {
    const service = createService();
    const signature = service.createSignature(secret, timestamp, body);

    expect(() =>
      service.verify(
        secret,
        Buffer.from('{"type":"order.created","id":"43"}'),
        String(timestamp),
        signature,
        nowMs,
      ),
    ).toThrow(UnauthorizedException);
  });

  it('rejects a signature made with another secret', () => {
    const service = createService();
    const signature = service.createSignature('hlsec_other', timestamp, body);

    expect(() =>
      service.verify(secret, body, String(timestamp), signature, nowMs),
    ).toThrow('Invalid webhook signature');
  });

  it('rejects a stale timestamp to prevent replay of old requests', () => {
    const service = createService(60);
    const oldTimestamp = timestamp - 61;
    const signature = service.createSignature(secret, oldTimestamp, body);

    expect(() =>
      service.verify(secret, body, String(oldTimestamp), signature, nowMs),
    ).toThrow('Webhook signature timestamp expired');
  });

  it('rejects malformed timestamp and signature headers', () => {
    const service = createService();

    expect(() =>
      service.verify(secret, body, 'not-a-timestamp', 'v1=x', nowMs),
    ).toThrow('Invalid webhook signature timestamp');
    expect(() =>
      service.verify(secret, body, String(timestamp), 'sha256=abc', nowMs),
    ).toThrow('Invalid webhook signature');
  });
});
