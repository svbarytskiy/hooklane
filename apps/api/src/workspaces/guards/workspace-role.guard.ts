import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { WorkspaceRole } from '@hooklane/contracts';
import { WORKSPACE_ROLES_KEY } from '../decorators/workspace-roles.decorator';
import { WorkspaceRequest } from '../workspaces.types';

@Injectable()
export class WorkspaceRoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<WorkspaceRole[]>(
      WORKSPACE_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<WorkspaceRequest>();

    if (!request.workspace || !requiredRoles.includes(request.workspace.role)) {
      throw new ForbiddenException('Insufficient workspace permissions');
    }

    return true;
  }
}
