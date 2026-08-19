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
      throw new Error(`HTTP step ${step.id} resolved URL must be a string`);
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
    let requestUrl = new URL(url);
    let response: Response | undefined;

    for (
      let redirects = 0;
      redirects <= this.policy.maxRedirects;
      redirects += 1
    ) {
      await this.policy.assertAllowed(requestUrl);
      response = await fetch(requestUrl, {
        method: step.config.method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal,
        redirect: "manual",
      });

      if (!this.isRedirect(response.status)) break;
      if (redirects === this.policy.maxRedirects) {
        throw new Error("HTTP redirect limit exceeded");
      }

      const location = response.headers.get("location");
      if (!location) throw new Error("HTTP redirect response has no location");
      const nextUrl = new URL(location, requestUrl);
      if (nextUrl.origin !== requestUrl.origin) {
        throw new Error("Cross-origin HTTP redirects are blocked by policy");
      }
      if (
        !["GET", "HEAD"].includes(step.config.method) &&
        [301, 302, 303].includes(response.status)
      ) {
        throw new Error(
          "HTTP redirect changes request semantics and is blocked",
        );
      }

      await response.body?.cancel();
      requestUrl = nextUrl;
    }

    if (!response) throw new Error("HTTP request did not produce a response");
    this.policy.assertResponseSize(response);

    const responseText = await this.readResponseText(response);
    if (!response.ok) {
      throw new Error(`HTTP step ${step.id} failed with ${response.status}`);
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
      throw new Error(`HTTP step ${stepId} headers must resolve to strings`);
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
          throw new Error(
            `HTTP response exceeds ${this.policy.maxResponseBytes} byte limit`,
          );
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
}
