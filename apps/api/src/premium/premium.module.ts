import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { BillingModule } from 'src/billing/billing.module';
import { PremiumAccessGuard } from './guards/premium-access.guard';
import { PremiumController } from './premium.controller';

@Module({
  imports: [AuthModule, BillingModule],
  controllers: [PremiumController],
  providers: [PremiumAccessGuard],
})
export class PremiumModule {}
