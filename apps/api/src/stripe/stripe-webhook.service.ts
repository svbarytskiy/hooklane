import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Stripe from 'stripe';
import { eq } from 'drizzle-orm';
import type { Env } from 'src/config/env.schema';
import { DATABASE } from 'src/database/database.tokens';
import type { Database } from 'src/database/database.types';
import { stripeWebhookEvents } from 'src/database/schema';
import { STRIPE_CLIENT } from './stripe.tokens';
import type { StripeClient } from './stripe.types';

export type StripeWebhookEventStatus =
  'received' | 'processed' | 'failed' | 'ignored';

type StoredWebhookEvent = {
  isNew: boolean;
  status: StripeWebhookEventStatus;
};

@Injectable()
export class StripeWebhookService {
  private readonly logger = new Logger(StripeWebhookService.name);

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

  async storeEvent(event: Stripe.Event): Promise<StoredWebhookEvent> {
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
          status: stripeWebhookEvents.status,
        });

      if (!storedEvent) {
        throw new InternalServerErrorException(
          'Stripe webhook event was not stored',
        );
      }

      return {
        isNew: true,
        status: storedEvent.status as StripeWebhookEventStatus,
      };
    } catch (error) {
      const cause =
        typeof error === 'object' && error !== null && 'cause' in error
          ? ((error as { cause?: unknown }).cause ?? error)
          : error;
      const databaseError = cause as {
        code?: string;
        detail?: string;
        constraint?: string;
        hint?: string;
      };

      this.logger.error(
        `Stripe webhook database error: ${JSON.stringify({
          code: databaseError.code,
          detail: databaseError.detail,
          constraint: databaseError.constraint,
          hint: databaseError.hint,
          message: cause instanceof Error ? cause.message : String(cause),
        })}`,
      );

      if (!this.isUniqueViolation(error)) {
        throw error;
      }

      const [existingEvent] = await this.db
        .select({
          status: stripeWebhookEvents.status,
        })
        .from(stripeWebhookEvents)
        .where(eq(stripeWebhookEvents.stripeEventId, event.id))
        .limit(1);

      if (!existingEvent) {
        throw new InternalServerErrorException(
          'Stripe webhook event already exists but could not be loaded',
        );
      }

      return {
        isNew: false,
        status: existingEvent.status as StripeWebhookEventStatus,
      };
    }
  }

  async markEventStatus(
    stripeEventId: string,
    status: Extract<StripeWebhookEventStatus, 'processed' | 'ignored'>,
  ): Promise<void> {
    await this.db
      .update(stripeWebhookEvents)
      .set({
        status,
        processedAt: status === 'processed' ? new Date() : null,
        error: null,
      })
      .where(eq(stripeWebhookEvents.stripeEventId, stripeEventId));
  }

  async markEventFailed(stripeEventId: string, error: unknown): Promise<void> {
    await this.db
      .update(stripeWebhookEvents)
      .set({
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown webhook error',
      })
      .where(eq(stripeWebhookEvents.stripeEventId, stripeEventId));
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
