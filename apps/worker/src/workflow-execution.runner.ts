import type {
  WorkflowDefinition,
  WorkflowExecutionError,
  WorkflowStep,
} from "@hooklane/contracts";
import { Injectable } from "@nestjs/common";
import {
  createExecutionRuntimeContext,
  isRecord,
  type ExecutionCheckpoint,
  type ExecutionRuntimeContext,
} from "./runtime/execution-runtime-context";
import { StepExecutorRegistry } from "./runtime/step-executor.registry";
import {
  toWorkflowExecutionError,
  WorkflowRuntimeError,
} from "./runtime/workflow-runtime.error";

type RunnerInput = {
  executionId: string;
  payload: unknown;
  definition: unknown;
  startStepIndex?: number;
  checkpoint?: unknown;
  lifecycle?: StepLifecycleCallbacks;
  limits?: ExecutionRuntimeLimits;
  isCancellationRequested?: () => Promise<boolean>;
};

export type ExecutionRuntimeLimits = {
  maxSteps: number;
  maxDurationMs: number;
  stepTimeoutMs: number;
};

const defaultLimits: ExecutionRuntimeLimits = {
  maxSteps: 50,
  maxDurationMs: 300_000,
  stepTimeoutMs: 30_000,
};

export class ExecutionCancelledError extends WorkflowRuntimeError {
  constructor() {
    super({
      code: "execution_cancelled",
      category: "cancellation",
      message: "Execution was cancelled",
      retryable: false,
    });
    this.name = "ExecutionCancelledError";
  }
}

export class ExecutionTimeoutError extends WorkflowRuntimeError {
  constructor(message: string) {
    super({
      code: "execution_timeout",
      category: "timeout",
      message,
      retryable: true,
    });
    this.name = "ExecutionTimeoutError";
  }
}

export type StepLifecycleCallbacks = {
  onStarted?: (step: WorkflowStep, index: number) => Promise<void>;
  onSucceeded?: (
    step: WorkflowStep,
    index: number,
    output: unknown,
  ) => Promise<void>;
  onFailed?: (
    step: WorkflowStep,
    index: number,
    error: WorkflowExecutionError,
  ) => Promise<void>;
  onSkipped?: (step: WorkflowStep, index: number) => Promise<void>;
};

type RunnerResult = {
  output: ExecutionRuntimeContext;
  executedSteps: number;
};

@Injectable()
export class WorkflowExecutionRunner {
  constructor(private readonly executors: StepExecutorRegistry) {}

  async run(input: RunnerInput): Promise<RunnerResult> {
    const definition = this.parseDefinition(input.definition);
    const limits = input.limits ?? defaultLimits;
    if (definition.steps.length > limits.maxSteps) {
      throw new WorkflowRuntimeError({
        code: "workflow_step_limit_exceeded",
        category: "validation",
        message: `Workflow has ${definition.steps.length} steps; limit is ${limits.maxSteps}`,
        retryable: false,
      });
    }

    const startStepIndex = input.startStepIndex ?? 0;
    if (startStepIndex < 0 || startStepIndex > definition.steps.length) {
      throw new WorkflowRuntimeError({
        code: "workflow_definition_invalid",
        category: "validation",
        message: `Recovery start step ${startStepIndex} is outside the workflow`,
        retryable: false,
      });
    }
    const context = createExecutionRuntimeContext(
      input.executionId,
      input.payload,
      this.parseCheckpoint(input.checkpoint),
    );
    const deadline = Date.now() + limits.maxDurationMs;
    let executedSteps = 0;

    for (const [relativeIndex, step] of definition.steps
      .slice(startStepIndex)
      .entries()) {
      const index = startStepIndex + relativeIndex;
      if (await input.isCancellationRequested?.()) {
        throw new ExecutionCancelledError();
      }
      if (Date.now() >= deadline) {
        throw new ExecutionTimeoutError("Workflow maximum duration exceeded");
      }

      await input.lifecycle?.onStarted?.(step, index);
      try {
        const result = await this.executeStep(
          step,
          context,
          Math.min(limits.stepTimeoutMs, deadline - Date.now()),
          input.isCancellationRequested,
        );
        context.steps[step.id] = { output: result.output };
        await input.lifecycle?.onSucceeded?.(step, index, result.output);
        executedSteps += 1;

        if (!result.shouldContinue) {
          for (const [skippedIndex, skippedStep] of definition.steps
            .slice(index + 1)
            .entries()) {
            await input.lifecycle?.onSkipped?.(
              skippedStep,
              index + skippedIndex + 1,
            );
          }
          break;
        }
      } catch (error) {
        await input.lifecycle?.onFailed?.(
          step,
          index,
          toWorkflowExecutionError(error, step.id),
        );
        throw error;
      }
    }

    return { output: context, executedSteps };
  }

  private parseCheckpoint(value: unknown): ExecutionCheckpoint | undefined {
    if (value === null || value === undefined) return undefined;
    if (
      !isRecord(value) ||
      !isRecord(value.variables) ||
      !isRecord(value.steps)
    ) {
      throw new WorkflowRuntimeError({
        code: "workflow_definition_invalid",
        category: "validation",
        message: "Execution recovery checkpoint is invalid",
        retryable: false,
      });
    }

    return {
      variables: value.variables,
      steps: value.steps as ExecutionCheckpoint["steps"],
    };
  }

  private parseDefinition(value: unknown): WorkflowDefinition {
    if (
      !value ||
      typeof value !== "object" ||
      !Array.isArray((value as { steps?: unknown }).steps)
    ) {
      throw new WorkflowRuntimeError({
        code: "workflow_definition_invalid",
        category: "validation",
        message: "Workflow definition is invalid at execution time",
        retryable: false,
      });
    }

    return value as WorkflowDefinition;
  }

  private async executeStep(
    step: WorkflowStep,
    context: ExecutionRuntimeContext,
    timeoutMs: number,
    isCancellationRequested?: () => Promise<boolean>,
  ) {
    if (timeoutMs <= 0) {
      throw new ExecutionTimeoutError("Workflow maximum duration exceeded");
    }

    const controller = new AbortController();
    const timeout = setTimeout(
      () =>
        controller.abort(
          new ExecutionTimeoutError(`Step ${step.id} exceeded its timeout`),
        ),
      timeoutMs,
    );
    const cancellationPoller = isCancellationRequested
      ? setInterval(() => {
          void isCancellationRequested()
            .then((cancelled) => {
              if (cancelled) controller.abort(new ExecutionCancelledError());
            })
            .catch(() => undefined);
        }, 1_000)
      : undefined;

    try {
      return await this.executors.execute(step, context, controller.signal);
    } finally {
      clearTimeout(timeout);
      if (cancellationPoller) clearInterval(cancellationPoller);
    }
  }
}
