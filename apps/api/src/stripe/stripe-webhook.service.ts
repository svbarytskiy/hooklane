import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Stripe from 'stripe';
import type { Env } from 'src/config/env.schema';
import { STRIPE_CLIENT } from './stripe.tokens';
import type { StripeClient } from './stripe.types';
import { DATABASE } from 'src/database/database.tokens';
import type { Database } from 'src/database/database.types';
import { stripeWebhookEvents } from 'src/database/schema';

@Injectable()
export class StripeWebhookService {
  constructor(
    @Inject(STRIPE_CLIENT)
    private readonly stripe: StripeClient,

    private readonly config: ConfigService<Env, true>,

    @Inject(DATABASE)
    private readonly db: Database,
  ) {}

  constructEvent(rawBody: Buffer, signature: string): Stripe.Event {
    const webhookSecret = this.config.get('STRIPE_WEBHOOK_SECRET', {
      infer: true,
    });

    try {
      return this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        webhookSecret,
      );
    } catch {
      throw new BadRequestException('Invalid Stripe webhook signature');
    }
  }

  async storeEvent(event: Stripe.Event): Promise<boolean> {
    try {
      const [storedEvent] = await this.db
        .insert(stripeWebhookEvents)
        .values({
          stripeEventId: event.id,
          eventType: event.type,
          status: 'received',
          payload: event,
        })
        .returning({
          id: stripeWebhookEvents.id,
        });

      return Boolean(storedEvent);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        return false;
      }

      throw error;
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === '23505'
    );
  }
}
