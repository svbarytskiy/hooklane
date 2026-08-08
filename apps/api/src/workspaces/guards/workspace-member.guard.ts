import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import type { WorkspaceRole } from '@hooklane/contracts';
import { isUUID } from 'class-validator';
import { WorkspacesService } from '../workspaces.service';
import { WorkspaceRequest } from '../workspaces.types';

@Injectable()
export class WorkspaceMemberGuard implements CanActivate {
  constructor(private readonly workspacesService: WorkspacesService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<WorkspaceRequest>();
    const rawWorkspaceId = request.params.workspaceId ?? request.params.id;

    const workspaceId = Array.isArray(rawWorkspaceId)
      ? rawWorkspaceId[0]
      : rawWorkspaceId;

    if (!workspaceId || !isUUID(workspaceId)) {
      throw new BadRequestException('Workspace id must be a valid UUID');
    }

    const membership = await this.workspacesService.getMembership(
      request.user.id,
      workspaceId,
    );

    request.workspace = {
      id: membership.id,
      role: membership.role as WorkspaceRole,
    };

    return true;
  }
}
