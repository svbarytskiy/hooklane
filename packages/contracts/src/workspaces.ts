export type WorkspaceRole = 'owner' | 'admin' | 'member';

export type WorkspaceMemberResponse = {
  userId: string;
  email: string | null;
  role: WorkspaceRole;
  createdAt: string;
};

export type CreateWorkspaceRequest = {
  name: string;
  slug: string;
};
