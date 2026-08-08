import type { Request } from 'express';
import type { AuthenticatedUser } from '@hooklane/contracts';
import type { WorkspaceRole } from '@hooklane/contracts';

export type WorkspaceContext = {
  id: string;
  role: WorkspaceRole;
};

export type WorkspaceRequest = Request & {
  user: AuthenticatedUser;
  workspace: WorkspaceContext;
};
