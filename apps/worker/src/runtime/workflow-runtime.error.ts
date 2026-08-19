import type {
  WorkflowExecutionError,
  WorkflowExecutionErrorCategory,
  WorkflowExecutionErrorCode,
} from "@hooklane/contracts";

type WorkflowRuntimeErrorInput = Omit<WorkflowExecutionError, "retryable"> & {
  retryable?: boolean;
};

const retryableCategories = new Set<WorkflowExecutionErrorCategory>([
  "rate_limit",
  "network",
  "upstream",
  "timeout",
]);

export class WorkflowRuntimeError extends Error {
  readonly code: WorkflowExecutionErrorCode;
  readonly category: WorkflowExecutionErrorCategory;
  readonly retryable: boolean;
  readonly stepId?: string;
  readonly httpStatus?: number;
  readonly retryAfterMs?: number;

  constructor(input: WorkflowRuntimeErrorInput, options?: ErrorOptions) {
    super(input.message, options);
    this.name = "WorkflowRuntimeError";
    this.code = input.code;
    this.category = input.category;
    this.retryable = input.retryable ?? retryableCategories.has(input.category);
    this.stepId = input.stepId;
    this.httpStatus = input.httpStatus;
    this.retryAfterMs = input.retryAfterMs;
  }

  toExecutionError(stepId?: string): WorkflowExecutionError {
    return {
      code: this.code,
      category: this.category,
      message: this.message,
      retryable: this.retryable,
      ...(this.stepId || stepId ? { stepId: this.stepId ?? stepId } : {}),
      ...(this.httpStatus !== undefined ? { httpStatus: this.httpStatus } : {}),
      ...(this.retryAfterMs !== undefined
        ? { retryAfterMs: this.retryAfterMs }
        : {}),
    };
  }
}

export function toWorkflowExecutionError(
  error: unknown,
  stepId?: string,
): WorkflowExecutionError {
  if (error instanceof WorkflowRuntimeError) {
    return error.toExecutionError(stepId);
  }

  return {
    code: "internal_error",
    category: "internal",
    message: error instanceof Error ? error.message : "Unknown workflow error",
    retryable: false,
    ...(stepId ? { stepId } : {}),
  };
}
