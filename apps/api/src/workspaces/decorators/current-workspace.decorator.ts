import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { WorkspaceRequest } from '../workspaces.types';

export const CurrentWorkspace = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<WorkspaceRequest>();
    return request.workspace;
  },
);
