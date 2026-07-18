import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { DatabaseModule } from 'src/database/database.module';
import { AuthModule } from 'src/auth/auth.module';
import { StripeModule } from 'src/stripe/stripe.module';
import { BillingCatalogService } from './billing-catalog.service';
import { CheckoutService } from './checkout.service';
import { SubscriptionService } from './subscription.service';
import { SubscriptionCheckoutService } from './subscription-checkout.service';

@Module({
  imports: [DatabaseModule, StripeModule, AuthModule],
  controllers: [BillingController],
  providers: [
    BillingService,
    BillingCatalogService,
    CheckoutService,
    SubscriptionService,
    SubscriptionCheckoutService,
  ],
  exports: [SubscriptionService],
})
export class BillingModule {}
