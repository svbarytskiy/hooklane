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
import { InvoiceService } from './invoice.service';
import { AdminBillingController } from './admin-billing.controller';

@Module({
  imports: [DatabaseModule, StripeModule, AuthModule],
  controllers: [BillingController, AdminBillingController],
  providers: [
    BillingService,
    BillingCatalogService,
    CheckoutService,
    SubscriptionService,
    SubscriptionCheckoutService,
    InvoiceService,
  ],
  exports: [SubscriptionService],
})
export class BillingModule {}
