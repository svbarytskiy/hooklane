import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { SupabaseAuthGuard } from 'src/auth/supabase-auth/supabase-auth.guard';
import { WorkspaceMemberGuard } from 'src/workspaces/guards/workspace-member.guard';
import { WorkspaceEntitlementsService } from './workspace-entitlements.service';

@Controller('workspaces/:workspaceId/entitlement')
@UseGuards(SupabaseAuthGuard, WorkspaceMemberGuard)
export class WorkspaceEntitlementsController {
  constructor(private readonly entitlements: WorkspaceEntitlementsService) {}

  @Get()
  getEffectiveEntitlement(
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
  ) {
    return this.entitlements.getEffectiveEntitlement(workspaceId);
  }
}
