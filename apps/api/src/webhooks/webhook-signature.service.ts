import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Env } from 'src/config/env.schema';

const SIGNATURE_VERSION = 'v1';

@Injectable()
export class WebhookSignatureService {
  private readonly toleranceSeconds: number;

  constructor(config: ConfigService<Env, true>) {
    this.toleranceSeconds = config.get('WEBHOOK_SIGNATURE_TOLERANCE_SECONDS', {
      infer: true,
    });
  }

  createSignature(secret: string, timestamp: number, rawBody: Buffer): string {
    const digest = createHmac('sha256', secret)
      .update(this.signedPayload(timestamp, rawBody))
      .digest('hex');

    return `${SIGNATURE_VERSION}=${digest}`;
  }

  verify(
    secret: string,
    rawBody: Buffer,
    timestampHeader: string,
    signatureHeader: string,
    nowMs = Date.now(),
  ): void {
    const timestamp = this.parseTimestamp(timestampHeader);
    const ageSeconds = Math.abs(Math.floor(nowMs / 1000) - timestamp);

    if (ageSeconds > this.toleranceSeconds) {
      throw new UnauthorizedException('Webhook signature timestamp expired');
    }

    const expectedSignature = this.createSignature(secret, timestamp, rawBody);
    const providedSignature = this.parseSignature(signatureHeader);
    const expectedBytes = Buffer.from(expectedSignature, 'utf8');
    const providedBytes = Buffer.from(providedSignature, 'utf8');

    if (
      expectedBytes.length !== providedBytes.length ||
      !timingSafeEqual(expectedBytes, providedBytes)
    ) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
  }

  private parseTimestamp(value: string): number {
    if (!/^\d+$/.test(value)) {
      throw new UnauthorizedException('Invalid webhook signature timestamp');
    }

    const timestamp = Number(value);

    if (!Number.isSafeInteger(timestamp) || timestamp <= 0) {
      throw new UnauthorizedException('Invalid webhook signature timestamp');
    }

    return timestamp;
  }

  private parseSignature(value: string): string {
    const prefix = `${SIGNATURE_VERSION}=`;

    if (!value.startsWith(prefix)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    const digest = value.slice(prefix.length);

    if (!/^[a-f0-9]{64}$/.test(digest)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    return value;
  }

  private signedPayload(timestamp: number, rawBody: Buffer): Buffer {
    return Buffer.concat([Buffer.from(`${timestamp}.`, 'utf8'), rawBody]);
  }
}
