export const WORKFLOW_EXECUTION_QUEUE = "workflow-executions";

export type ExecuteWorkflowJob = {
  executionId: string;
  incomingEventId: string;
  workflowVersionId: string;
};
