import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from 'src/config/env.schema';
import { STRIPE_CLIENT } from './stripe.tokens';
import Stripe from 'stripe';
import { StripeWebhookController } from './stripe-webhook.controller';
import { StripeWebhookService } from './stripe-webhook.service';
import { DatabaseModule } from 'src/database/database.module';
import { StripeWebhookProcessor } from './stripe-webhook-processor.service';
import { InvoiceSyncService } from './invoice-sync.service';
import { RefundService } from './refund.service';

@Module({
  imports: [DatabaseModule],
  controllers: [StripeWebhookController],
  providers: [
    {
      provide: STRIPE_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const secretKey = config.get('STRIPE_SECRET_KEY', {
          infer: true,
        });

        return new Stripe(secretKey);
      },
    },
    StripeWebhookService,
    StripeWebhookProcessor,
    InvoiceSyncService,
    RefundService,
  ],
  exports: [STRIPE_CLIENT, StripeWebhookService, RefundService],
})
export class StripeModule {}
