export const workflowExecutionErrorCategories = [
  "validation",
  "authentication",
  "authorization",
  "rate_limit",
  "network",
  "upstream",
  "timeout",
  "cancellation",
  "ambiguous",
  "internal",
] as const;

export type WorkflowExecutionErrorCategory =
  (typeof workflowExecutionErrorCategories)[number];

export const workflowExecutionErrorCodes = [
  "workflow_definition_invalid",
  "workflow_step_limit_exceeded",
  "execution_cancelled",
  "execution_timeout",
  "worker_interrupted",
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
  "http_ambiguous_result",
  "integration_connection_unavailable",
  "integration_token_unavailable",
  "slack_message_invalid",
  "slack_authentication_failed",
  "slack_authorization_failed",
  "slack_rate_limited",
  "slack_upstream_error",
  "slack_ambiguous_result",
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
