import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SupabaseAuthGuard } from 'src/auth/supabase-auth/supabase-auth.guard';
import { WorkspaceMemberGuard } from 'src/workspaces/guards/workspace-member.guard';
import { WorkspaceRoleGuard } from 'src/workspaces/guards/workspace-role.guard';
import { WorkspaceRoles } from 'src/workspaces/decorators/workspace-roles.decorator';
import { ExecutionHistoryService } from './execution-history.service';

@Controller('workspaces/:workspaceId/workflows/:workflowId/executions')
@UseGuards(SupabaseAuthGuard, WorkspaceMemberGuard)
export class ExecutionHistoryController {
  constructor(private readonly history: ExecutionHistoryService) {}

  @Get()
  list(
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
    @Param('workflowId', new ParseUUIDPipe()) workflowId: string,
  ) {
    return this.history.listExecutions(workspaceId, workflowId);
  }

  @Get(':executionId')
  get(
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
    @Param('workflowId', new ParseUUIDPipe()) workflowId: string,
    @Param('executionId', new ParseUUIDPipe()) executionId: string,
  ) {
    return this.history.getExecution(workspaceId, workflowId, executionId);
  }

  @Post(':executionId/cancel')
  @UseGuards(WorkspaceRoleGuard)
  @WorkspaceRoles('owner', 'admin')
  cancel(
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
    @Param('workflowId', new ParseUUIDPipe()) workflowId: string,
    @Param('executionId', new ParseUUIDPipe()) executionId: string,
  ) {
    return this.history.cancelExecution(workspaceId, workflowId, executionId);
  }
}
