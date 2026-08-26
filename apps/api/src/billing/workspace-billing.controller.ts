import type { AuthenticatedUser } from '@hooklane/contracts';
import {
  Body,
  Controller,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from 'src/auth/current-user.decorator';
import { SupabaseAuthGuard } from 'src/auth/supabase-auth/supabase-auth.guard';
import { WorkspaceRoles } from 'src/workspaces/decorators/workspace-roles.decorator';
import { WorkspaceMemberGuard } from 'src/workspaces/guards/workspace-member.guard';
import { WorkspaceRoleGuard } from 'src/workspaces/guards/workspace-role.guard';
import { CreateSubscriptionCheckoutDto } from './dto/create-subscription-checkout.dto';
import { WorkspaceSubscriptionCheckoutService } from './workspace-subscription-checkout.service';

@Controller('workspaces/:workspaceId/billing')
@UseGuards(SupabaseAuthGuard, WorkspaceMemberGuard, WorkspaceRoleGuard)
@WorkspaceRoles('owner')
export class WorkspaceBillingController {
  constructor(
    private readonly checkout: WorkspaceSubscriptionCheckoutService,
  ) {}

  @Post('checkout/subscription')
  createSubscriptionCheckout(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
    @Body() dto: CreateSubscriptionCheckoutDto,
    @Headers('Idempotency-Key') idempotencyKey: string | undefined,
  ) {
    return this.checkout.createCheckout(user, workspaceId, dto, idempotencyKey);
  }
}
