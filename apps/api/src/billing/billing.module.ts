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
import { AdminBillingService } from './admin-billing.service';
import { EntitlementsModule } from 'src/entitlements/entitlements.module';
import { WorkspaceSubscriptionCheckoutService } from './workspace-subscription-checkout.service';
import { WorkspaceBillingController } from './workspace-billing.controller';

@Module({
  imports: [DatabaseModule, StripeModule, AuthModule, EntitlementsModule],
  controllers: [
    BillingController,
    AdminBillingController,
    WorkspaceBillingController,
  ],
  providers: [
    BillingService,
    BillingCatalogService,
    CheckoutService,
    SubscriptionService,
    SubscriptionCheckoutService,
    InvoiceService,
    AdminBillingService,
    WorkspaceSubscriptionCheckoutService,
  ],
  exports: [SubscriptionService],
})
export class BillingModule {}
