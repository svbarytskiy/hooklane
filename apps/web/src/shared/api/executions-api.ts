import type {
  CancelExecutionResponse,
  ExecutionDetail,
  ExecutionObservability,
  ExecutionSummary,
  RecoverExecutionResponse,
  ReplayExecutionResponse,
  ResumeExecutionRequest,
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

export async function getExecutionObservability(
  workspaceId: string,
  workflowId: string,
) {
  const { data } = await apiClient.get<ExecutionObservability>(
    `${executionPath(workspaceId, workflowId)}/observability/summary`,
  );
  return data;
}

export async function retryFailedStep(
  workspaceId: string,
  workflowId: string,
  executionId: string,
) {
  const { data } = await apiClient.post<RecoverExecutionResponse>(
    `${executionPath(workspaceId, workflowId)}/${executionId}/retry-failed-step`,
  );
  return data;
}

export async function resumeExecution(
  workspaceId: string,
  workflowId: string,
  executionId: string,
  request: ResumeExecutionRequest,
) {
  const { data } = await apiClient.post<RecoverExecutionResponse>(
    `${executionPath(workspaceId, workflowId)}/${executionId}/resume`,
    request,
  );
  return data;
}

export async function replayExecution(
  workspaceId: string,
  workflowId: string,
  executionId: string,
) {
  const { data } = await apiClient.post<ReplayExecutionResponse>(
    `${executionPath(workspaceId, workflowId)}/${executionId}/replay-as-new`,
  );
  return data;
}

export async function deadLetterExecution(
  workspaceId: string,
  workflowId: string,
  executionId: string,
) {
  const { data } = await apiClient.post<RecoverExecutionResponse>(
    `${executionPath(workspaceId, workflowId)}/${executionId}/dead-letter`,
  );
  return data;
}
