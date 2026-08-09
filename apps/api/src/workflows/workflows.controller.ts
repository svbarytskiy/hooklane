import type { AuthenticatedUser } from '@hooklane/contracts';
import {
  Body,
  Controller,
  Get,
  Patch,
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
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDraftDto } from './dto/update-workflow-draft.dto';
import { WorkflowsService } from './workflows.service';

@Controller('workspaces/:workspaceId/workflows')
@UseGuards(SupabaseAuthGuard, WorkspaceMemberGuard)
export class WorkflowsController {
  constructor(private readonly workflowsService: WorkflowsService) {}

  @Post()
  @UseGuards(WorkspaceRoleGuard)
  @WorkspaceRoles('owner', 'admin')
  createWorkflow(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
    @Body() dto: CreateWorkflowDto,
  ) {
    return this.workflowsService.createWorkflow(
      user.id,
      workspaceId,
      dto.name,
      dto.slug,
    );
  }

  @Get()
  listWorkflows(
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
  ) {
    return this.workflowsService.listWorkflows(workspaceId);
  }

  @Get(':workflowId')
  getWorkflow(
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
    @Param('workflowId', new ParseUUIDPipe()) workflowId: string,
  ) {
    return this.workflowsService.getWorkflow(workspaceId, workflowId);
  }

  @Get(':workflowId/draft')
  getDraft(
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
    @Param('workflowId', new ParseUUIDPipe()) workflowId: string,
  ) {
    return this.workflowsService.getDraft(workspaceId, workflowId);
  }

  @Get(':workflowId/versions')
  listVersions(
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
    @Param('workflowId', new ParseUUIDPipe()) workflowId: string,
  ) {
    return this.workflowsService.listVersions(workspaceId, workflowId);
  }

  @Patch(':workflowId/draft')
  @UseGuards(WorkspaceRoleGuard)
  @WorkspaceRoles('owner', 'admin')
  updateDraft(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
    @Param('workflowId', new ParseUUIDPipe()) workflowId: string,
    @Body() dto: UpdateWorkflowDraftDto,
  ) {
    return this.workflowsService.updateDraft(
      user.id,
      workspaceId,
      workflowId,
      dto.definition,
    );
  }

  @Post(':workflowId/validate')
  @UseGuards(WorkspaceRoleGuard)
  @WorkspaceRoles('owner', 'admin')
  validateDraft(
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
    @Param('workflowId', new ParseUUIDPipe()) workflowId: string,
  ) {
    return this.workflowsService.validateDraft(workspaceId, workflowId);
  }

  @Post(':workflowId/publish')
  @UseGuards(WorkspaceRoleGuard)
  @WorkspaceRoles('owner', 'admin')
  publishWorkflow(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
    @Param('workflowId', new ParseUUIDPipe()) workflowId: string,
  ) {
    return this.workflowsService.publishWorkflow(
      user.id,
      workspaceId,
      workflowId,
    );
  }

  @Post(':workflowId/archive')
  @UseGuards(WorkspaceRoleGuard)
  @WorkspaceRoles('owner', 'admin')
  archiveWorkflow(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
    @Param('workflowId', new ParseUUIDPipe()) workflowId: string,
  ) {
    return this.workflowsService.archiveWorkflow(
      user.id,
      workspaceId,
      workflowId,
    );
  }
}
