import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from 'src/config/env.schema';
import { STRIPE_CLIENT } from './stripe.tokens';
import Stripe from 'stripe';

@Module({
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
  ],
  exports: [STRIPE_CLIENT],
})
export class StripeModule {}
