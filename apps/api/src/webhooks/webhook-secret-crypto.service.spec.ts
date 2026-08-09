import { ConfigService } from '@nestjs/config';
import type { Env } from 'src/config/env.schema';
import { WebhookSecretCryptoService } from './webhook-secret-crypto.service';

const encryptionKey = Buffer.alloc(32, 7).toString('base64');
const anotherEncryptionKey = Buffer.alloc(32, 8).toString('base64');

function createService(key = encryptionKey): WebhookSecretCryptoService {
  const config = {
    get: jest.fn().mockReturnValue(key),
  } as unknown as ConfigService<Env, true>;

  return new WebhookSecretCryptoService(config);
}

describe('WebhookSecretCryptoService', () => {
  it('generates a prefixed, high-entropy secret', () => {
    const secret = createService().generateSecret();

    expect(secret).toMatch(/^hlsec_[A-Za-z0-9_-]{43}$/);
  });

  it('decrypts a secret encrypted with the same key', () => {
    const service = createService();
    const secret = 'hlsec_example-secret';

    expect(service.decrypt(service.encrypt(secret))).toBe(secret);
  });

  it('uses a new initialization vector for every encryption', () => {
    const service = createService();
    const secret = 'hlsec_example-secret';

    expect(service.encrypt(secret)).not.toBe(service.encrypt(secret));
  });

  it('rejects a malformed or tampered envelope', () => {
    const service = createService();
    const envelope = service.encrypt('hlsec_example-secret');

    expect(() => service.decrypt('v1.not-valid')).toThrow(
      'Invalid encrypted webhook secret',
    );
    expect(() => service.decrypt(`${envelope}x`)).toThrow(
      'Unable to decrypt webhook secret',
    );
  });

  it('rejects an envelope encrypted with another key', () => {
    const envelope = createService().encrypt('hlsec_example-secret');

    expect(() => createService(anotherEncryptionKey).decrypt(envelope)).toThrow(
      'Unable to decrypt webhook secret',
    );
  });
});
