import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SupabaseAuthGuard } from 'src/auth/supabase-auth/supabase-auth.guard';
import { RefundService } from 'src/stripe/refund.service';
import { CreateRefundDto } from './dto/create-refund.dto';
import { AdminGuard } from 'src/auth/admin/admin.guard';
import {
  AdminInvoicesResponse,
  AdminPaymentsResponse,
  AdminRefundsResponse,
  CreateRefundResponse,
} from '@billing-lab/contracts';
import { AdminBillingService } from './admin-billing.service';
import { AdminListQueryDto } from './dto/admin-list-query.dto';

@Controller('admin')
@UseGuards(SupabaseAuthGuard, AdminGuard)
export class AdminBillingController {
  constructor(
    private readonly refundService: RefundService,
    private readonly adminBillingService: AdminBillingService,
  ) {}

  @Post('payments/:id/refund')
  createRefund(
    @Param('id', ParseUUIDPipe) paymentId: string,
    @Body() dto: CreateRefundDto,
    @Headers('Idempotency-Key')
    idempotencyKey: string | undefined,
  ): Promise<CreateRefundResponse> {
    return this.refundService.createPaymentRefund(
      paymentId,
      dto.amount,
      idempotencyKey,
    );
  }

  @Post('invoices/:id/refund')
  createInvoiceRefund(
    @Param('id', ParseUUIDPipe) invoiceId: string,
    @Body() dto: CreateRefundDto,
    @Headers('Idempotency-Key')
    idempotencyKey: string | undefined,
  ): Promise<CreateRefundResponse> {
    return this.refundService.createInvoiceRefund(
      invoiceId,
      dto.amount,
      idempotencyKey,
    );
  }

  @Get('payments')
  getPayments(
    @Query() query: AdminListQueryDto,
  ): Promise<AdminPaymentsResponse> {
    return this.adminBillingService.getPayments(query);
  }

  @Get('invoices')
  getInvoices(
    @Query() query: AdminListQueryDto,
  ): Promise<AdminInvoicesResponse> {
    return this.adminBillingService.getInvoices(query);
  }

  @Get('refunds')
  getRefunds(): Promise<AdminRefundsResponse> {
    return this.refundService.getRefunds();
  }
}
