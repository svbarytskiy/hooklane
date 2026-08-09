import type {
  CreateWorkflowRequest,
  UpdateWorkflowDraftRequest,
  ValidateWorkflowDraftResponse,
  WorkflowDefinition,
  WorkflowStatus,
  WorkflowValidationError,
  WorkflowVersionSummary,
  WorkflowVersionState,
} from "@hooklane/contracts";
import { apiClient } from "./api-client";

export type WorkflowSummary = {
  id: string;
  name: string;
  slug: string;
  status: WorkflowStatus;
  createdAt: string;
  updatedAt: string;
};

export type WorkflowDraft = {
  id: string;
  workflowId: string;
  versionNumber: number;
  state: WorkflowVersionState;
  definition: WorkflowDefinition;
  validationErrors: WorkflowValidationError[] | null;
  updatedAt: string;
};

export type CreateWorkflowResponse = WorkflowSummary & {
  draft: WorkflowDraft;
};

export type PublishWorkflowResponse = {
  publishedVersion: WorkflowDraft;
  nextDraft: WorkflowDraft;
};

export type { WorkflowVersionSummary } from "@hooklane/contracts";

function workflowPath(workspaceId: string, workflowId?: string) {
  const base = `/workspaces/${workspaceId}/workflows`;
  return workflowId ? `${base}/${workflowId}` : base;
}

export async function getWorkflows(workspaceId: string) {
  const { data } = await apiClient.get<WorkflowSummary[]>(
    workflowPath(workspaceId),
  );
  return data;
}

export async function createWorkflow(
  workspaceId: string,
  input: CreateWorkflowRequest,
) {
  const { data } = await apiClient.post<CreateWorkflowResponse>(
    workflowPath(workspaceId),
    input,
  );
  return data;
}

export async function getWorkflow(workspaceId: string, workflowId: string) {
  const { data } = await apiClient.get<WorkflowSummary>(
    workflowPath(workspaceId, workflowId),
  );
  return data;
}

export async function getWorkflowDraft(
  workspaceId: string,
  workflowId: string,
) {
  const { data } = await apiClient.get<WorkflowDraft>(
    `${workflowPath(workspaceId, workflowId)}/draft`,
  );
  return data;
}

export async function getWorkflowVersions(
  workspaceId: string,
  workflowId: string,
) {
  const { data } = await apiClient.get<WorkflowVersionSummary[]>(
    `${workflowPath(workspaceId, workflowId)}/versions`,
  );
  return data;
}

export async function updateWorkflowDraft(
  workspaceId: string,
  workflowId: string,
  input: UpdateWorkflowDraftRequest,
) {
  const { data } = await apiClient.patch<WorkflowDraft>(
    `${workflowPath(workspaceId, workflowId)}/draft`,
    input,
  );
  return data;
}

export async function validateWorkflowDraft(
  workspaceId: string,
  workflowId: string,
) {
  const { data } = await apiClient.post<ValidateWorkflowDraftResponse>(
    `${workflowPath(workspaceId, workflowId)}/validate`,
  );
  return data;
}

export async function publishWorkflow(workspaceId: string, workflowId: string) {
  const { data } = await apiClient.post<PublishWorkflowResponse>(
    `${workflowPath(workspaceId, workflowId)}/publish`,
  );
  return data;
}

export async function archiveWorkflow(workspaceId: string, workflowId: string) {
  const { data } = await apiClient.post<WorkflowSummary>(
    `${workflowPath(workspaceId, workflowId)}/archive`,
  );
  return data;
}
