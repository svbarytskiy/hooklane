export type WebhookEndpointStatus = "active" | "inactive";

export type WebhookSignatureMode = "none" | "hmac_sha256";

export type IncomingEventStatus = "accepted";

export type ExecutionStatus =
  | "pending"
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "dead_lettered";

export type WebhookEndpointSummary = {
  id: string;
  workflowId: string;
  name: string;
  publicId: string;
  url: string;
  status: WebhookEndpointStatus;
  signatureMode: WebhookSignatureMode;
  secretLastRotatedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type IncomingEventReceipt = {
  eventId: string;
  executionId: string;
  status: "accepted";
  duplicate: boolean;
};

export type WebhookDeliveryHistoryItem = {
  eventId: string;
  executionId: string;
  endpointId: string;
  sourceEventId: string | null;
  workflowVersionId: string;
  eventStatus: IncomingEventStatus;
  executionStatus: ExecutionStatus;
  payload: unknown;
  payloadSizeBytes: number;
  receivedAt: string;
  createdAt: string;
};

export type ExecutionStepStatus =
  "running" | "succeeded" | "failed" | "skipped";

export type ExecutionSummary = {
  id: string;
  workflowId: string;
  workflowName: string;
  workflowVersionId: string;
  incomingEventId: string;
  status: ExecutionStatus;
  queuedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  failure: unknown;
  runSequence: number;
  replayedFromExecutionId: string | null;
  deadLetteredAt: string | null;
  createdAt: string;
};

export type ExecutionAttempt = {
  id: string;
  attemptNumber: number;
  status: "running" | "succeeded" | "failed";
  startedAt: string | null;
  completedAt: string | null;
  error: unknown;
};

export type ExecutionStep = {
  id: string;
  attemptId: string;
  stepId: string;
  stepIndex: number;
  status: ExecutionStepStatus;
  input: unknown;
  output: unknown;
  error: unknown;
  startedAt: string | null;
  completedAt: string | null;
};

export type ExecutionDetail = ExecutionSummary & {
  attempts: ExecutionAttempt[];
  steps: ExecutionStep[];
  recoveries: ExecutionRecovery[];
};

export type ExecutionRecoveryOperation =
  "retry_failed_step" | "resume" | "replay_as_new" | "dead_letter";

export type ExecutionRecovery = {
  id: string;
  operation: ExecutionRecoveryOperation;
  fromAttemptId: string | null;
  stepId: string | null;
  targetExecutionId: string | null;
  requestedBy: string;
  createdAt: string;
};

export type ResumeExecutionRequest = {
  stepId: string;
  output: unknown;
};

export type RecoverExecutionResponse = {
  recoveryId: string;
  executionId: string;
  status: ExecutionStatus;
};

export type ReplayExecutionResponse = RecoverExecutionResponse & {
  sourceExecutionId: string;
};

export type ExecutionObservability = {
  executions: {
    byStatus: Partial<Record<ExecutionStatus, number>>;
    total: number;
    retried: number;
    ambiguous: number;
    averageDurationMs: number | null;
  };
  queue: {
    waiting: number;
    active: number;
    delayed: number;
    failed: number;
    completed: number;
    oldestWaitingAgeMs: number | null;
  };
};

export type CancelExecutionResponse = {
  id: string;
  status: "cancelled";
};

export type CreateWebhookEndpointRequest = {
  name: string;
  signatureMode?: "hmac_sha256" | "none";
};

export type CreateWebhookEndpointResponse = {
  endpoint: WebhookEndpointSummary;
  signingSecret: string | null;
};

export type UpdateWebhookEndpointRequest = {
  status: WebhookEndpointStatus;
};

export type RotateWebhookEndpointSecretResponse = {
  endpoint: WebhookEndpointSummary;
  signingSecret: string;
};
