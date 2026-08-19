import type { AuthenticatedUser } from '@hooklane/contracts';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from 'src/auth/current-user.decorator';
import { SupabaseAuthGuard } from 'src/auth/supabase-auth/supabase-auth.guard';
import { WorkspaceMemberGuard } from 'src/workspaces/guards/workspace-member.guard';
import { WorkspaceRoleGuard } from 'src/workspaces/guards/workspace-role.guard';
import { WorkspaceRoles } from 'src/workspaces/decorators/workspace-roles.decorator';
import { ExecutionHistoryService } from './execution-history.service';
import { ResumeExecutionDto } from './dto/resume-execution.dto';

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

  @Get('observability/summary')
  observability(
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
    @Param('workflowId', new ParseUUIDPipe()) workflowId: string,
  ) {
    return this.history.getObservability(workspaceId, workflowId);
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

  @Post(':executionId/retry-failed-step')
  @UseGuards(WorkspaceRoleGuard)
  @WorkspaceRoles('owner', 'admin')
  retryFailedStep(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
    @Param('workflowId', new ParseUUIDPipe()) workflowId: string,
    @Param('executionId', new ParseUUIDPipe()) executionId: string,
  ) {
    return this.history.retryFailedStep(
      workspaceId,
      workflowId,
      executionId,
      user.id,
    );
  }

  @Post(':executionId/resume')
  @UseGuards(WorkspaceRoleGuard)
  @WorkspaceRoles('owner', 'admin')
  resume(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
    @Param('workflowId', new ParseUUIDPipe()) workflowId: string,
    @Param('executionId', new ParseUUIDPipe()) executionId: string,
    @Body() request: ResumeExecutionDto,
  ) {
    return this.history.resumeExecution(
      workspaceId,
      workflowId,
      executionId,
      user.id,
      request,
    );
  }

  @Post(':executionId/replay-as-new')
  @UseGuards(WorkspaceRoleGuard)
  @WorkspaceRoles('owner', 'admin')
  replayAsNew(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
    @Param('workflowId', new ParseUUIDPipe()) workflowId: string,
    @Param('executionId', new ParseUUIDPipe()) executionId: string,
  ) {
    return this.history.replayAsNew(
      workspaceId,
      workflowId,
      executionId,
      user.id,
    );
  }

  @Post(':executionId/dead-letter')
  @UseGuards(WorkspaceRoleGuard)
  @WorkspaceRoles('owner', 'admin')
  deadLetter(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
    @Param('workflowId', new ParseUUIDPipe()) workflowId: string,
    @Param('executionId', new ParseUUIDPipe()) executionId: string,
  ) {
    return this.history.deadLetterExecution(
      workspaceId,
      workflowId,
      executionId,
      user.id,
    );
  }
}
