export const workflowExecutionErrorCategories = [
  "validation",
  "authentication",
  "authorization",
  "rate_limit",
  "network",
  "upstream",
  "timeout",
  "cancellation",
  "internal",
] as const;

export type WorkflowExecutionErrorCategory =
  (typeof workflowExecutionErrorCategories)[number];

export const workflowExecutionErrorCodes = [
  "workflow_definition_invalid",
  "workflow_step_limit_exceeded",
  "execution_cancelled",
  "execution_timeout",
  "http_url_invalid",
  "http_request_invalid",
  "http_request_rejected",
  "http_dns_lookup_failed",
  "http_network_error",
  "http_response_too_large",
  "http_authentication_failed",
  "http_authorization_failed",
  "http_request_timeout",
  "http_rate_limited",
  "http_upstream_error",
  "internal_error",
] as const;

export type WorkflowExecutionErrorCode =
  (typeof workflowExecutionErrorCodes)[number];

export type WorkflowExecutionError = {
  code: WorkflowExecutionErrorCode;
  category: WorkflowExecutionErrorCategory;
  message: string;
  retryable: boolean;
  stepId?: string;
  httpStatus?: number;
  retryAfterMs?: number;
};
