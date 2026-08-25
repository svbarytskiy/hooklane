import type { SlackSendMessageStep } from "@hooklane/contracts";
import { Injectable } from "@nestjs/common";
import { SlackConnectionTokenService } from "../integrations/slack-connection-token.service";
import { ExpressionResolverService } from "./expression-resolver.service";
import type { ExecutionRuntimeContext } from "./execution-runtime-context";
import { parseRetryAfter } from "./http-request-step.executor";
import type { StepExecutionResult, StepExecutor } from "./step-executor.types";
import { WorkflowRuntimeError } from "./workflow-runtime.error";

const SLACK_POST_MESSAGE_URL = "https://slack.com/api/chat.postMessage";
const SLACK_TEXT_LIMIT = 4_000;

type SlackPostMessageResponse = {
  ok?: boolean;
  error?: string;
  channel?: string;
  ts?: string;
};

@Injectable()
export class SlackSendMessageStepExecutor implements StepExecutor<SlackSendMessageStep> {
  readonly type = "slack_send_message" as const;

  constructor(
    private readonly tokens: SlackConnectionTokenService,
    private readonly expressions: ExpressionResolverService,
  ) {}

  async execute(
    step: SlackSendMessageStep,
    context: ExecutionRuntimeContext,
    signal: AbortSignal,
  ): Promise<StepExecutionResult> {
    const accessToken = await this.tokens.getAccessToken(
      context.execution.workspaceId,
      step.config.connectionId,
      step.id,
    );

    const channel = step.config.channel.trim();
    const text = this.expressions.resolveTextTemplate(
      step.config.text,
      context,
    );
    if (!channel || !text.trim() || text.length > SLACK_TEXT_LIMIT) {
      throw new WorkflowRuntimeError({
        code: "slack_message_invalid",
        category: "validation",
        message: `Slack step ${step.id} resolved an invalid channel or message text`,
        retryable: false,
        stepId: step.id,
      });
    }

    let response: Response;
    try {
      response = await fetch(SLACK_POST_MESSAGE_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({ channel, text }),
        signal,
      });
    } catch (error) {
      if (signal.aborted && signal.reason instanceof Error) throw signal.reason;
      throw new WorkflowRuntimeError(
        {
          code: "slack_ambiguous_result",
          category: "ambiguous",
          message: `Slack step ${step.id} may have posted a message before the request failed`,
          retryable: false,
          stepId: step.id,
        },
        { cause: error },
      );
    }

    const body = await this.parseResponse(response, step.id, signal);
    if (!response.ok || body.ok !== true) {
      throw this.toSlackError(step.id, response, body.error);
    }
    if (!body.channel || !body.ts) {
      throw new WorkflowRuntimeError({
        code: "slack_upstream_error",
        category: "upstream",
        message: `Slack step ${step.id} returned an incomplete success response`,
        retryable: false,
        stepId: step.id,
      });
    }

    return {
      output: { channel: body.channel, messageTs: body.ts },
      shouldContinue: true,
    };
  }

  private async parseResponse(
    response: Response,
    stepId: string,
    signal: AbortSignal,
  ): Promise<SlackPostMessageResponse> {
    try {
      return (await response.json()) as SlackPostMessageResponse;
    } catch (error) {
      if (signal.aborted && signal.reason instanceof Error) {
        throw signal.reason;
      }
      if (response.status >= 500) {
        throw new WorkflowRuntimeError(
          {
            code: "slack_ambiguous_result",
            category: "ambiguous",
            message: `Slack step ${stepId} may have posted a message before an invalid response`,
            retryable: false,
            stepId,
            httpStatus: response.status,
          },
          { cause: error },
        );
      }
      throw new WorkflowRuntimeError(
        {
          code: "slack_upstream_error",
          category: "upstream",
          message: `Slack step ${stepId} returned an invalid response`,
          retryable: false,
          stepId,
          httpStatus: response.status,
        },
        { cause: error },
      );
    }
  }

  private toSlackError(
    stepId: string,
    response: Response,
    slackError: string | undefined,
  ): WorkflowRuntimeError {
    const common = {
      message: `Slack step ${stepId} failed${slackError ? `: ${slackError}` : ""}`,
      stepId,
      httpStatus: response.status,
    };
    if (response.status === 429 || slackError === "ratelimited") {
      return new WorkflowRuntimeError({
        ...common,
        code: "slack_rate_limited",
        category: "rate_limit",
        retryAfterMs: parseRetryAfter(response.headers.get("retry-after")),
      });
    }
    if (
      ["invalid_auth", "not_authed", "token_expired", "token_revoked"].includes(
        slackError ?? "",
      )
    ) {
      return new WorkflowRuntimeError({
        ...common,
        code: "slack_authentication_failed",
        category: "authentication",
        retryable: false,
      });
    }
    if (
      ["missing_scope", "no_permission", "not_in_channel"].includes(
        slackError ?? "",
      )
    ) {
      return new WorkflowRuntimeError({
        ...common,
        code: "slack_authorization_failed",
        category: "authorization",
        retryable: false,
      });
    }
    if (response.status >= 500 || slackError === "service_unavailable") {
      return new WorkflowRuntimeError({
        ...common,
        code: "slack_ambiguous_result",
        category: "ambiguous",
        message: `Slack step ${stepId} may have posted a message before returning an upstream error`,
        retryable: false,
      });
    }
    return new WorkflowRuntimeError({
      ...common,
      code: "slack_message_invalid",
      category: "validation",
      retryable: false,
    });
  }
}
