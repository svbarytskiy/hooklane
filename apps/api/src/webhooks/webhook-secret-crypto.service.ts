import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { Env } from 'src/config/env.schema';

const ENVELOPE_VERSION = 'v1';
const INITIALIZATION_VECTOR_BYTES = 12;
const AUTHENTICATION_TAG_BYTES = 16;

@Injectable()
export class WebhookSecretCryptoService {
  private readonly encryptionKey: Buffer;

  constructor(config: ConfigService<Env, true>) {
    const encodedKey = config.get('WEBHOOK_SECRETS_ENCRYPTION_KEY', {
      infer: true,
    });

    if (typeof encodedKey !== 'string') {
      throw new Error('Invalid webhook secrets encryption key');
    }

    this.encryptionKey = Buffer.from(encodedKey, 'base64');
  }

  generateSecret(): string {
    return `hlsec_${randomBytes(32).toString('base64url')}`;
  }

  encrypt(plaintext: string): string {
    const initializationVector = randomBytes(INITIALIZATION_VECTOR_BYTES);
    const cipher = createCipheriv(
      'aes-256-gcm',
      this.encryptionKey,
      initializationVector,
    );
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authenticationTag = cipher.getAuthTag();

    return [
      ENVELOPE_VERSION,
      initializationVector.toString('base64url'),
      authenticationTag.toString('base64url'),
      ciphertext.toString('base64url'),
    ].join('.');
  }

  decrypt(envelope: string): string {
    const [
      version,
      initializationVectorValue,
      authenticationTagValue,
      ciphertextValue,
      ...rest
    ] = envelope.split('.');

    if (
      version !== ENVELOPE_VERSION ||
      !initializationVectorValue ||
      !authenticationTagValue ||
      !ciphertextValue ||
      rest.length > 0
    ) {
      throw new Error('Invalid encrypted webhook secret');
    }

    const initializationVector = this.decodeEnvelopePart(
      initializationVectorValue,
    );
    const authenticationTag = this.decodeEnvelopePart(authenticationTagValue);
    const ciphertext = this.decodeEnvelopePart(ciphertextValue);

    if (
      initializationVector.length !== INITIALIZATION_VECTOR_BYTES ||
      authenticationTag.length !== AUTHENTICATION_TAG_BYTES ||
      ciphertext.length === 0
    ) {
      throw new Error('Invalid encrypted webhook secret');
    }

    try {
      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.encryptionKey,
        initializationVector,
      );
      decipher.setAuthTag(authenticationTag);

      return Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new Error('Unable to decrypt webhook secret');
    }
  }

  private decodeEnvelopePart(value: string): Buffer {
    if (!/^[A-Za-z0-9_-]+$/.test(value)) {
      throw new Error('Invalid encrypted webhook secret');
    }

    return Buffer.from(value, 'base64url');
  }
}
