export type WorkflowStatus = "active" | "archived";

export type WorkflowVersionState = "draft" | "published";

export type WorkflowStepType =
  "http_request" | "transform" | "condition" | "delay";

export type WorkflowDefinition = {
  steps: WorkflowStep[];
};

type WorkflowStepBase<TType extends WorkflowStepType, TConfig> = {
  id: string;
  type: TType;
  name: string;
  config: TConfig;
};

export type HttpRequestStepConfig = {
  url: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: Record<string, string>;
  body?: unknown;
};

export type TransformStepConfig = {
  assignments: Record<string, string>;
};

export type ConditionStepConfig = {
  expression: string;
};

export type DelayStepConfig = {
  durationMs: number;
};

export type HttpRequestStep = WorkflowStepBase<
  "http_request",
  HttpRequestStepConfig
>;

export type TransformStep = WorkflowStepBase<"transform", TransformStepConfig>;

export type ConditionStep = WorkflowStepBase<"condition", ConditionStepConfig>;

export type DelayStep = WorkflowStepBase<"delay", DelayStepConfig>;

export type WorkflowStep =
  HttpRequestStep | TransformStep | ConditionStep | DelayStep;

export type WorkflowValidationError = {
  path: string;
  code: string;
  message: string;
};

export type CreateWorkflowRequest = {
  name: string;
  slug: string;
};

export type UpdateWorkflowDraftRequest = {
  definition: WorkflowDefinition;
};

export type ValidateWorkflowDraftResponse = {
  isValid: boolean;
  errors: WorkflowValidationError[];
};

export type WorkflowVersionSummary = {
  id: string;
  versionNumber: number;
  state: WorkflowVersionState;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
