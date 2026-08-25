import type { WorkflowStep } from "@hooklane/contracts";
import { Injectable } from "@nestjs/common";
import { ConditionStepExecutor } from "./condition-step.executor";
import { DelayStepExecutor } from "./delay-step.executor";
import type { ExecutionRuntimeContext } from "./execution-runtime-context";
import { HttpRequestStepExecutor } from "./http-request-step.executor";
import type { StepExecutionResult, StepExecutor } from "./step-executor.types";
import { TransformStepExecutor } from "./transform-step.executor";
import { SlackSendMessageStepExecutor } from "./slack-send-message-step.executor";

@Injectable()
export class StepExecutorRegistry {
  private readonly executors = new Map<WorkflowStep["type"], StepExecutor>();

  constructor(
    transform: TransformStepExecutor,
    condition: ConditionStepExecutor,
    httpRequest: HttpRequestStepExecutor,
    delay: DelayStepExecutor,
    slackSendMessage: SlackSendMessageStepExecutor,
  ) {
    this.executors.set(transform.type, transform);
    this.executors.set(condition.type, condition);
    this.executors.set(httpRequest.type, httpRequest);
    this.executors.set(delay.type, delay);
    this.executors.set(slackSendMessage.type, slackSendMessage);
  }

  execute(
    step: WorkflowStep,
    context: ExecutionRuntimeContext,
    signal: AbortSignal,
  ): Promise<StepExecutionResult> {
    const executor = this.executors.get(step.type);
    if (!executor)
      throw new Error(`No executor registered for step type: ${step.type}`);
    return executor.execute(step, context, signal);
  }
}
