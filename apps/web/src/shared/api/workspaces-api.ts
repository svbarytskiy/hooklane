import type {
  CreateWorkspaceRequest,
  WorkspaceMemberResponse,
  WorkspaceRole,
} from '@hooklane/contracts';
import { apiClient } from './api-client';

export type { WorkspaceRole } from '@hooklane/contracts';

export type WorkspaceSummary = {
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceMember = WorkspaceMemberResponse;

export async function getWorkspaces(): Promise<WorkspaceSummary[]> {
  const { data } = await apiClient.get<WorkspaceSummary[]>('/workspaces');
  return data;
}

export async function createWorkspace(
  input: CreateWorkspaceRequest,
): Promise<WorkspaceSummary> {
  const { data } = await apiClient.post<WorkspaceSummary>('/workspaces', input);
  return data;
}

export async function getWorkspaceMembers(
  workspaceId: string,
): Promise<WorkspaceMember[]> {
  const { data } = await apiClient.get<WorkspaceMember[]>(
    `/workspaces/${workspaceId}/members`,
  );
  return data;
}
