import type { TransformStep } from "@hooklane/contracts";
import { Injectable } from "@nestjs/common";
import { ExpressionResolverService } from "./expression-resolver.service";
import {
  type ExecutionRuntimeContext,
  setRuntimePath,
} from "./execution-runtime-context";
import type { StepExecutionResult, StepExecutor } from "./step-executor.types";

@Injectable()
export class TransformStepExecutor implements StepExecutor<TransformStep> {
  readonly type = "transform" as const;

  constructor(private readonly expressions: ExpressionResolverService) {}

  execute(
    step: TransformStep,
    context: ExecutionRuntimeContext,
    signal: AbortSignal,
  ): Promise<StepExecutionResult> {
    void signal;
    const assigned: Record<string, unknown> = {};

    for (const [path, expression] of Object.entries(step.config.assignments)) {
      const value = this.expressions.resolveValue(expression, context);
      setRuntimePath(context.variables, path, value);
      setRuntimePath(assigned, path, value);
    }

    return Promise.resolve({ output: { assigned }, shouldContinue: true });
  }
}
