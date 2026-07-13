import type { AuthenticatedUser } from '@billing-lab/contracts';
import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from 'src/auth/current-user.decorator';
import { SupabaseAuthGuard } from 'src/auth/supabase-auth/supabase-auth.guard';
import { BillingService } from './billing.service';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @UseGuards(SupabaseAuthGuard)
  @Post('customer')
  createCustomer(@CurrentUser() user: AuthenticatedUser) {
    return this.billingService.createCustomer(user);
  }

  @UseGuards(SupabaseAuthGuard)
  @Get('state')
  getBillingState(@CurrentUser() user: AuthenticatedUser) {
    return this.billingService.getBillingState(user.id);
  }
}
