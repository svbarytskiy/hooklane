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
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { WorkspacesService } from './workspaces.service';
import { WorkspaceMemberGuard } from './guards/workspace-member.guard';

@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @UseGuards(SupabaseAuthGuard)
  @Post()
  createWorkspace(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateWorkspaceDto,
  ) {
    return this.workspacesService.createWorkspace(user.id, dto.name, dto.slug);
  }

  @UseGuards(SupabaseAuthGuard)
  @Get()
  getWorkspaces(@CurrentUser() user: AuthenticatedUser) {
    return this.workspacesService.getWorkspaces(user.id);
  }

  @UseGuards(SupabaseAuthGuard, WorkspaceMemberGuard)
  @Get(':id')
  getWorkspace(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.workspacesService.getWorkspace(user.id, id);
  }

  @UseGuards(SupabaseAuthGuard, WorkspaceMemberGuard)
  @Get(':workspaceId/members')
  listMembers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
  ) {
    return this.workspacesService.listMembers(user.id, workspaceId);
  }
}
