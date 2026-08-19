import type { WorkflowStep } from "@hooklane/contracts";
import type { ExecutionRuntimeContext } from "./execution-runtime-context";

export type StepExecutionResult = {
  output: unknown;
  shouldContinue: boolean;
};

export interface StepExecutor<TStep extends WorkflowStep = WorkflowStep> {
  readonly type: TStep["type"];
  execute(
    step: TStep,
    context: ExecutionRuntimeContext,
    signal: AbortSignal,
  ): Promise<StepExecutionResult>;
}
