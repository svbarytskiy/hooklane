import type { HttpRequestStep } from "@hooklane/contracts";
import { Injectable } from "@nestjs/common";
import { ExpressionResolverService } from "./expression-resolver.service";
import { ExecutionDataSanitizerService } from "./execution-data-sanitizer.service";
import { HttpRequestPolicyService } from "./http-request-policy.service";
import {
  isRecord,
  type ExecutionRuntimeContext,
} from "./execution-runtime-context";
import type { StepExecutionResult, StepExecutor } from "./step-executor.types";
import { WorkflowRuntimeError } from "./workflow-runtime.error";

@Injectable()
export class HttpRequestStepExecutor implements StepExecutor<HttpRequestStep> {
  readonly type = "http_request" as const;

  constructor(
    private readonly expressions: ExpressionResolverService,
    private readonly policy: HttpRequestPolicyService,
    private readonly sanitizer: ExecutionDataSanitizerService,
  ) {}

  async execute(
    step: HttpRequestStep,
    context: ExecutionRuntimeContext,
    signal: AbortSignal,
  ): Promise<StepExecutionResult> {
    const url = this.expressions.resolveValue(step.config.url, context);
    if (typeof url !== "string") {
      throw this.validationError(
        step.id,
        `HTTP step ${step.id} resolved URL must be a string`,
      );
    }

    const body =
      step.config.body === undefined
        ? undefined
        : this.expressions.resolveValue(step.config.body, context);
    const resolvedHeaders = this.expressions.resolveValue(
      step.config.headers ?? {},
      context,
    );
    const headers = this.toHeaders(
      resolvedHeaders,
      step.id,
      body !== undefined,
    );
    let requestUrl: URL;
    try {
      requestUrl = new URL(url);
    } catch (error) {
      throw new WorkflowRuntimeError(
        {
          code: "http_url_invalid",
          category: "validation",
          message: `HTTP step ${step.id} resolved an invalid URL`,
          retryable: false,
          stepId: step.id,
        },
        { cause: error },
      );
    }
    let response: Response | undefined;

    for (
      let redirects = 0;
      redirects <= this.policy.maxRedirects;
      redirects += 1
    ) {
      await this.policy.assertAllowed(requestUrl);
      try {
        response = await fetch(requestUrl, {
          method: step.config.method,
          headers,
          body: body === undefined ? undefined : JSON.stringify(body),
          signal,
          redirect: "manual",
        });
      } catch (error) {
        if (signal.aborted && signal.reason instanceof Error) {
          throw signal.reason;
        }
        throw new WorkflowRuntimeError(
          {
            code: "http_network_error",
            category: "network",
            message: `HTTP step ${step.id} could not reach ${requestUrl.host}`,
            stepId: step.id,
          },
          { cause: error },
        );
      }

      if (!this.isRedirect(response.status)) break;
      if (redirects === this.policy.maxRedirects) {
        throw this.validationError(step.id, "HTTP redirect limit exceeded");
      }

      const location = response.headers.get("location");
      if (!location) {
        throw this.validationError(
          step.id,
          "HTTP redirect response has no location",
        );
      }
      const nextUrl = new URL(location, requestUrl);
      if (nextUrl.origin !== requestUrl.origin) {
        throw this.validationError(
          step.id,
          "Cross-origin HTTP redirects are blocked by policy",
        );
      }
      if (
        !["GET", "HEAD"].includes(step.config.method) &&
        [301, 302, 303].includes(response.status)
      ) {
        throw this.validationError(
          step.id,
          "HTTP redirect changes request semantics and is blocked",
        );
      }

      await response.body?.cancel();
      requestUrl = nextUrl;
    }

    if (!response) {
      throw new WorkflowRuntimeError({
        code: "http_network_error",
        category: "network",
        message: "HTTP request did not produce a response",
        stepId: step.id,
      });
    }
    this.policy.assertResponseSize(response);

    let responseText: string;
    try {
      responseText = await this.readResponseText(response);
    } catch (error) {
      if (error instanceof WorkflowRuntimeError) throw error;
      if (signal.aborted && signal.reason instanceof Error) {
        throw signal.reason;
      }
      throw new WorkflowRuntimeError(
        {
          code: "http_network_error",
          category: "network",
          message: `HTTP step ${step.id} response stream was interrupted`,
          stepId: step.id,
        },
        { cause: error },
      );
    }
    if (!response.ok) {
      throw this.responseError(step.id, response);
    }

    return {
      output: {
        status: response.status,
        headers: this.sanitizer.redact(
          Object.fromEntries(response.headers.entries()),
        ),
        body: this.sanitizer.redact(this.parseResponseBody(responseText)),
      },
      shouldContinue: true,
    };
  }

  private toHeaders(
    value: unknown,
    stepId: string,
    hasBody: boolean,
  ): Record<string, string> {
    if (
      !isRecord(value) ||
      Object.values(value).some((item) => typeof item !== "string")
    ) {
      throw this.validationError(
        stepId,
        `HTTP step ${stepId} headers must resolve to strings`,
      );
    }

    return {
      ...(hasBody ? { "content-type": "application/json" } : {}),
      ...(value as Record<string, string>),
    };
  }

  private parseResponseBody(responseText: string): unknown {
    if (!responseText) return null;
    try {
      return JSON.parse(responseText);
    } catch {
      return responseText;
    }
  }

  private isRedirect(status: number): boolean {
    return [301, 302, 303, 307, 308].includes(status);
  }

  private async readResponseText(response: Response): Promise<string> {
    if (!response.body) return "";

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let receivedBytes = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        receivedBytes += value.byteLength;
        if (receivedBytes > this.policy.maxResponseBytes) {
          await reader.cancel();
          throw new WorkflowRuntimeError({
            code: "http_response_too_large",
            category: "validation",
            message: `HTTP response exceeds ${this.policy.maxResponseBytes} byte limit`,
            retryable: false,
          });
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }

    const responseBytes = new Uint8Array(receivedBytes);
    let offset = 0;
    for (const chunk of chunks) {
      responseBytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return new TextDecoder().decode(responseBytes);
  }

  private responseError(
    stepId: string,
    response: Response,
  ): WorkflowRuntimeError {
    const common = {
      message: `HTTP step ${stepId} failed with ${response.status}`,
      stepId,
      httpStatus: response.status,
    };

    if (response.status === 401) {
      return new WorkflowRuntimeError({
        ...common,
        code: "http_authentication_failed",
        category: "authentication",
        retryable: false,
      });
    }
    if (response.status === 403) {
      return new WorkflowRuntimeError({
        ...common,
        code: "http_authorization_failed",
        category: "authorization",
        retryable: false,
      });
    }
    if (response.status === 408) {
      return new WorkflowRuntimeError({
        ...common,
        code: "http_request_timeout",
        category: "timeout",
      });
    }
    if (response.status === 429) {
      return new WorkflowRuntimeError({
        ...common,
        code: "http_rate_limited",
        category: "rate_limit",
        retryAfterMs: parseRetryAfter(response.headers.get("retry-after")),
      });
    }
    if (response.status >= 500) {
      return new WorkflowRuntimeError({
        ...common,
        code: "http_upstream_error",
        category: "upstream",
        retryAfterMs: parseRetryAfter(response.headers.get("retry-after")),
      });
    }

    return new WorkflowRuntimeError({
      ...common,
      code: "http_request_invalid",
      category: "validation",
      retryable: false,
    });
  }

  private validationError(stepId: string, message: string) {
    return new WorkflowRuntimeError({
      code: "http_request_invalid",
      category: "validation",
      message,
      retryable: false,
      stepId,
    });
  }
}

export function parseRetryAfter(
  value: string | null,
  now = Date.now(),
): number | undefined {
  if (!value) return undefined;

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.round(seconds * 1_000);
  }

  const retryAt = Date.parse(value);
  return Number.isFinite(retryAt) ? Math.max(0, retryAt - now) : undefined;
}
