import type {
  AuthenticatedUser,
  BillingInvoicesResponse,
  BillingSubscriptionResponse,
  BillingUpcomingInvoiceResponse,
  CreateBillingPortalResponse,
} from '@billing-lab/contracts';
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
import { SubscriptionCheckoutService } from './subscription-checkout.service';
import { CreateSubscriptionCheckoutDto } from './dto/create-subscription-checkout.dto';
import { SubscriptionService } from './subscription.service';
import { InvoiceService } from './invoice.service';

@Controller('billing')
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly checkoutService: CheckoutService,
    private readonly subscriptionCheckoutService: SubscriptionCheckoutService,
    private readonly subscriptionService: SubscriptionService,
    private readonly invoiceService: InvoiceService,
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

  @UseGuards(SupabaseAuthGuard)
  @Post('checkout/subscription')
  createSubscriptionCheckout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSubscriptionCheckoutDto,
    @Headers('Idempotency-Key') idempotencyKey: string | undefined,
  ) {
    return this.subscriptionCheckoutService.createSubscriptionCheckout(
      user,
      dto,
      idempotencyKey,
    );
  }

  @UseGuards(SupabaseAuthGuard)
  @Get('subscription')
  getSubscription(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BillingSubscriptionResponse> {
    return this.subscriptionService.getSubscriptionState(user.id);
  }

  @UseGuards(SupabaseAuthGuard)
  @Get('invoices')
  getInvoices(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BillingInvoicesResponse> {
    return this.invoiceService.getInvoices(user.id);
  }

  @UseGuards(SupabaseAuthGuard)
  @Get('invoices/upcoming')
  getUpcomingInvoice(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BillingUpcomingInvoiceResponse> {
    return this.invoiceService.getUpcomingInvoice(user.id);
  }

  @UseGuards(SupabaseAuthGuard)
  @Post('portal')
  createBillingPortalSession(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CreateBillingPortalResponse> {
    return this.billingService.createBillingPortalSession(user);
  }
}
