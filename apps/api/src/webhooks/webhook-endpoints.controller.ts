import type { AuthenticatedUser } from '@hooklane/contracts';
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from 'src/auth/current-user.decorator';
import { SupabaseAuthGuard } from 'src/auth/supabase-auth/supabase-auth.guard';
import { WorkspaceRoles } from 'src/workspaces/decorators/workspace-roles.decorator';
import { WorkspaceMemberGuard } from 'src/workspaces/guards/workspace-member.guard';
import { WorkspaceRoleGuard } from 'src/workspaces/guards/workspace-role.guard';
import { CreateWebhookEndpointDto } from './dto/create-webhook-endpoint.dto';
import { UpdateWebhookEndpointDto } from './dto/update-webhook-endpoint.dto';
import { WebhookEndpointsService } from './webhook-endpoints.service';

@Controller('workspaces/:workspaceId/workflows/:workflowId/webhook-endpoints')
@UseGuards(SupabaseAuthGuard, WorkspaceMemberGuard)
export class WebhookEndpointsController {
  constructor(
    private readonly webhookEndpointsService: WebhookEndpointsService,
  ) {}

  @Get()
  listWebhookEndpoints(
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
    @Param('workflowId', new ParseUUIDPipe()) workflowId: string,
  ) {
    return this.webhookEndpointsService.listWebhookEndpoints(
      workspaceId,
      workflowId,
    );
  }

  @Post()
  @UseGuards(WorkspaceRoleGuard)
  @WorkspaceRoles('owner', 'admin')
  createWebhookEndpoint(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
    @Param('workflowId', new ParseUUIDPipe()) workflowId: string,
    @Body() dto: CreateWebhookEndpointDto,
  ) {
    return this.webhookEndpointsService.createWebhookEndpoint(
      user.id,
      workspaceId,
      workflowId,
      dto,
    );
  }

  @Patch(':endpointId')
  @UseGuards(WorkspaceRoleGuard)
  @WorkspaceRoles('owner', 'admin')
  updateWebhookEndpoint(
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
    @Param('workflowId', new ParseUUIDPipe()) workflowId: string,
    @Param('endpointId', new ParseUUIDPipe()) endpointId: string,
    @Body() dto: UpdateWebhookEndpointDto,
  ) {
    return this.webhookEndpointsService.updateWebhookEndpoint(
      workspaceId,
      workflowId,
      endpointId,
      dto,
    );
  }

  @Post(':endpointId/rotate-secret')
  @UseGuards(WorkspaceRoleGuard)
  @WorkspaceRoles('owner', 'admin')
  rotateWebhookEndpointSecret(
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
    @Param('workflowId', new ParseUUIDPipe()) workflowId: string,
    @Param('endpointId', new ParseUUIDPipe()) endpointId: string,
  ) {
    return this.webhookEndpointsService.rotateWebhookEndpointSecret(
      workspaceId,
      workflowId,
      endpointId,
    );
  }
}
