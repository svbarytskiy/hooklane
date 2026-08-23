export const EXECUTION_NOTIFICATIONS_CHANNEL =
  "hooklane:execution-notifications:v1";

export const REALTIME_NAMESPACE = "/realtime";
export const EXECUTION_NOTIFICATION_EVENT = "execution.notification";
export const WORKSPACE_SUBSCRIBE_EVENT = "workspace.subscribe";

export const executionNotificationTypes = [
  "execution.started",
  "execution.retry_scheduled",
  "execution.succeeded",
  "execution.failed",
  "execution.attempt.started",
  "execution.attempt.succeeded",
  "execution.attempt.failed",
  "execution.step.started",
  "execution.step.succeeded",
  "execution.step.failed",
  "execution.step.skipped",
] as const;

export type ExecutionNotificationType =
  (typeof executionNotificationTypes)[number];

export type ExecutionNotificationData = {
  attemptId?: string;
  attemptNumber?: number;
  stepId?: string;
  stepIndex?: number;
  status?: string;
  recoveredFromInterruptedWorker?: boolean;
};

export type ExecutionNotificationV1 = {
  version: 1;
  eventId: string;
  type: ExecutionNotificationType;
  sequence: number;
  workspaceId: string;
  workflowId: string;
  executionId: string;
  occurredAt: string;
  data: ExecutionNotificationData;
};

export type WorkspaceSubscriptionRequest = {
  workspaceId: string;
};

export type WorkspaceSubscriptionResponse =
  | { ok: true; workspaceId: string }
  | { ok: false; error: string };

export function isExecutionNotificationV1(
  value: unknown,
): value is ExecutionNotificationV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const notification = value as Record<string, unknown>;
  return (
    notification.version === 1 &&
    typeof notification.eventId === "string" &&
    typeof notification.type === "string" &&
    executionNotificationTypes.includes(
      notification.type as ExecutionNotificationType,
    ) &&
    typeof notification.sequence === "number" &&
    Number.isInteger(notification.sequence) &&
    notification.sequence > 0 &&
    typeof notification.workspaceId === "string" &&
    typeof notification.workflowId === "string" &&
    typeof notification.executionId === "string" &&
    typeof notification.occurredAt === "string" &&
    !!notification.data &&
    typeof notification.data === "object" &&
    !Array.isArray(notification.data)
  );
}
