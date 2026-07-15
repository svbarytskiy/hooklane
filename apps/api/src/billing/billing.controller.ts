import type { AuthenticatedUser } from '@billing-lab/contracts';
import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from 'src/auth/current-user.decorator';
import { SupabaseAuthGuard } from 'src/auth/supabase-auth/supabase-auth.guard';
import { BillingService } from './billing.service';
import { CheckoutService } from './checkout.service';
import { CreateCreditsCheckoutDto } from './dto/create-credits-checkout.dto';

@Controller('billing')
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly checkoutService: CheckoutService,
  ) {}

  @UseGuards(SupabaseAuthGuard)
  @Post('customer')
  createCustomer(@CurrentUser() user: AuthenticatedUser) {
    return this.billingService.createCustomer(user);
  }

  @UseGuards(SupabaseAuthGuard)
  @Post('checkout/credits')
  createCreditsCheckout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCreditsCheckoutDto,
    @Headers('Idempotency-Key') idempotencyKey: string | undefined,
  ) {
    return this.checkoutService.createCreditsCheckout(
      user,
      dto,
      idempotencyKey,
    );
  }

  @UseGuards(SupabaseAuthGuard)
  @Get('state')
  getBillingState(@CurrentUser() user: AuthenticatedUser) {
    return this.billingService.getBillingState(user.id);
  }

  @UseGuards(SupabaseAuthGuard)
  @Get('payments')
  getPayments(@CurrentUser() user: AuthenticatedUser) {
    return this.billingService.getPayments(user.id);
  }

  @UseGuards(SupabaseAuthGuard)
  @Get('credits')
  getCredits(@CurrentUser() user: AuthenticatedUser) {
    return this.billingService.getCreditsBalance(user.id);
  }
}
