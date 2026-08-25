import { ConfigService } from '@nestjs/config';
import type { Env } from 'src/config/env.schema';
import { OAuthTokenCryptoService } from './oauth-token-crypto.service';

const encryptionKey = Buffer.alloc(32, 7).toString('base64');
const anotherEncryptionKey = Buffer.alloc(32, 8).toString('base64');

function createService(key = encryptionKey) {
  const config = {
    get: jest.fn().mockReturnValue(key),
  } as unknown as ConfigService<Env, true>;

  return new OAuthTokenCryptoService(config);
}

function createUnconfiguredService() {
  const config = {
    get: jest.fn().mockReturnValue(undefined),
  } as unknown as ConfigService<Env, true>;

  return new OAuthTokenCryptoService(config);
}

describe('OAuthTokenCryptoService', () => {
  it('round-trips a token with the current key version', () => {
    const service = createService();
    const ciphertext = service.encrypt('xoxe-access-token');

    expect(service.decrypt(ciphertext, service.getCurrentKeyVersion())).toBe(
      'xoxe-access-token',
    );
  });

  it('uses a different IV every time', () => {
    const service = createService();

    expect(service.encrypt('xoxe-access-token')).not.toBe(
      service.encrypt('xoxe-access-token'),
    );
  });

  it('does not attempt to decrypt with an unknown key version', () => {
    expect(() => createService().decrypt('v1.any.value.here', 2)).toThrow(
      'Unsupported OAuth token encryption key version',
    );
  });

  it('rejects a ciphertext encrypted by a different key', () => {
    const ciphertext = createService().encrypt('xoxe-access-token');

    expect(() =>
      createService(anotherEncryptionKey).decrypt(ciphertext, 1),
    ).toThrow('Unable to decrypt OAuth token');
  });

  it('fails closed when OAuth encryption is not configured', () => {
    expect(() =>
      createUnconfiguredService().encrypt('xoxe-access-token'),
    ).toThrow('OAuth token encryption is not configured');
  });
});
