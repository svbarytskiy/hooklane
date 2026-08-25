import type { AuthenticatedUser } from '@hooklane/contracts';
import {
  Controller,
  Delete,
  Get,
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
import { OAuthConnectionsService } from './oauth-connections.service';

@Controller('workspaces/:workspaceId/integrations')
@UseGuards(SupabaseAuthGuard, WorkspaceMemberGuard)
export class OAuthConnectionsController {
  constructor(private readonly oauthConnections: OAuthConnectionsService) {}

  @Get()
  listConnections(
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
  ) {
    return this.oauthConnections.listConnections(workspaceId);
  }

  @Post('slack/authorize')
  @UseGuards(WorkspaceRoleGuard)
  @WorkspaceRoles('owner', 'admin')
  beginSlackAuthorization(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
  ) {
    return this.oauthConnections.beginAuthorization(
      user.id,
      workspaceId,
      'slack',
    );
  }

  @Delete(':connectionId')
  @UseGuards(WorkspaceRoleGuard)
  @WorkspaceRoles('owner', 'admin')
  async disconnectConnection(
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
    @Param('connectionId', new ParseUUIDPipe()) connectionId: string,
  ) {
    await this.oauthConnections.disconnectConnection(workspaceId, connectionId);
  }
}
