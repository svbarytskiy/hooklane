import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { DatabaseModule } from 'src/database/database.module';
import { AuthModule } from 'src/auth/auth.module';
import { StripeModule } from 'src/stripe/stripe.module';

@Module({
  imports: [DatabaseModule, StripeModule, AuthModule],
  controllers: [BillingController],
  providers: [BillingService],
})
export class BillingModule {}
