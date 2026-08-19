import type { WorkflowDefinition, WorkflowStep } from "@hooklane/contracts";
import { Injectable } from "@nestjs/common";
import {
  createExecutionRuntimeContext,
  type ExecutionRuntimeContext,
} from "./runtime/execution-runtime-context";
import { StepExecutorRegistry } from "./runtime/step-executor.registry";

type RunnerInput = {
  payload: unknown;
  definition: unknown;
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

export class ExecutionCancelledError extends Error {
  constructor() {
    super("Execution was cancelled");
    this.name = "ExecutionCancelledError";
  }
}

export class ExecutionTimeoutError extends Error {
  constructor(message: string) {
    super(message);
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
    error: { code: string; message: string; stepId: string },
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
      throw new ExecutionTimeoutError(
        `Workflow has ${definition.steps.length} steps; limit is ${limits.maxSteps}`,
      );
    }

    const context = createExecutionRuntimeContext(input.payload);
    const deadline = Date.now() + limits.maxDurationMs;
    let executedSteps = 0;

    for (const [index, step] of definition.steps.entries()) {
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
        if (error instanceof ExecutionCancelledError) {
          await input.lifecycle?.onFailed?.(step, index, {
            code: "execution_cancelled",
            message: error.message,
            stepId: step.id,
          });
          throw error;
        }
        const message =
          error instanceof Error ? error.message : "Unknown step error";
        await input.lifecycle?.onFailed?.(step, index, {
          code: "step_execution_failed",
          message,
          stepId: step.id,
        });
        throw error;
      }
    }

    return { output: context, executedSteps };
  }

  private parseDefinition(value: unknown): WorkflowDefinition {
    if (
      !value ||
      typeof value !== "object" ||
      !Array.isArray((value as { steps?: unknown }).steps)
    ) {
      throw new Error("Workflow definition is invalid at execution time");
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
