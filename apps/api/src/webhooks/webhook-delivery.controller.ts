import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SupabaseAuthGuard } from 'src/auth/supabase-auth/supabase-auth.guard';
import { WorkspaceMemberGuard } from 'src/workspaces/guards/workspace-member.guard';
import { WebhookDeliveryService } from './webhook-delivery.service';

@Controller('workspaces/:workspaceId/workflows/:workflowId/webhook-deliveries')
@UseGuards(SupabaseAuthGuard, WorkspaceMemberGuard)
export class WebhookDeliveryController {
  constructor(
    private readonly webhookDeliveryService: WebhookDeliveryService,
  ) {}

  @Get()
  listDeliveries(
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
    @Param('workflowId', new ParseUUIDPipe()) workflowId: string,
    @Query('limit') limit?: string,
  ) {
    return this.webhookDeliveryService.listDeliveries(
      workspaceId,
      workflowId,
      limit,
    );
  }
}
