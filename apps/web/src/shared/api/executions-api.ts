import type {
  CancelExecutionResponse,
  ExecutionDetail,
  ExecutionSummary,
} from "@hooklane/contracts";
import { apiClient } from "./api-client";

function executionPath(workspaceId: string, workflowId: string) {
  return `/workspaces/${workspaceId}/workflows/${workflowId}/executions`;
}

export async function getExecutions(workspaceId: string, workflowId: string) {
  const { data } = await apiClient.get<ExecutionSummary[]>(
    executionPath(workspaceId, workflowId),
  );
  return data;
}

export async function getExecution(
  workspaceId: string,
  workflowId: string,
  executionId: string,
) {
  const { data } = await apiClient.get<ExecutionDetail>(
    `${executionPath(workspaceId, workflowId)}/${executionId}`,
  );
  return data;
}

export async function cancelExecution(
  workspaceId: string,
  workflowId: string,
  executionId: string,
) {
  const { data } = await apiClient.post<CancelExecutionResponse>(
    `${executionPath(workspaceId, workflowId)}/${executionId}/cancel`,
  );
  return data;
}
