import type { ConditionStep } from "@hooklane/contracts";
import { Injectable } from "@nestjs/common";
import { ExpressionResolverService } from "./expression-resolver.service";
import type { ExecutionRuntimeContext } from "./execution-runtime-context";
import type { StepExecutionResult, StepExecutor } from "./step-executor.types";

@Injectable()
export class ConditionStepExecutor implements StepExecutor<ConditionStep> {
  readonly type = "condition" as const;

  constructor(private readonly expressions: ExpressionResolverService) {}

  execute(
    step: ConditionStep,
    context: ExecutionRuntimeContext,
    signal: AbortSignal,
  ): Promise<StepExecutionResult> {
    void signal;
    const match = step.config.expression.match(
      /^(.+?)\s*(===|!==|==|!=)\s*(.+)$/,
    );
    const matched = match
      ? this.compare(
          this.expressions.resolveExpression(match[1], context),
          match[2],
          this.expressions.resolveExpression(match[3], context),
        )
      : Boolean(
          this.expressions.resolveExpression(step.config.expression, context),
        );

    return Promise.resolve({ output: { matched }, shouldContinue: matched });
  }

  private compare(left: unknown, operator: string, right: unknown): boolean {
    return operator === "===" || operator === "=="
      ? left === right
      : left !== right;
  }
}
