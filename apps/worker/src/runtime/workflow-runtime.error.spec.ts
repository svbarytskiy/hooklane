/// <reference types="jest" />

import { parseRetryAfter } from "./http-request-step.executor";
import {
  toWorkflowExecutionError,
  WorkflowRuntimeError,
} from "./workflow-runtime.error";

describe("workflow retry policy", () => {
  it("classifies known runtime errors into a persistence-safe shape", () => {
    const error = new WorkflowRuntimeError({
      code: "http_rate_limited",
      category: "rate_limit",
      message: "Too many requests",
      stepId: "http-1",
      httpStatus: 429,
      retryAfterMs: 5_000,
    });

    expect(toWorkflowExecutionError(error)).toEqual({
      code: "http_rate_limited",
      category: "rate_limit",
      message: "Too many requests",
      retryable: true,
      stepId: "http-1",
      httpStatus: 429,
      retryAfterMs: 5_000,
    });
  });

  it("treats unknown errors as terminal internal failures", () => {
    expect(toWorkflowExecutionError(new Error("bug"))).toEqual({
      code: "internal_error",
      category: "internal",
      message: "bug",
      retryable: false,
    });
  });

  it("parses Retry-After seconds and HTTP dates", () => {
    const now = Date.parse("2026-08-19T12:00:00.000Z");

    expect(parseRetryAfter("2.5", now)).toBe(2_500);
    expect(parseRetryAfter("Wed, 19 Aug 2026 12:00:05 GMT", now)).toBe(5_000);
    expect(parseRetryAfter("not-a-date", now)).toBeUndefined();
  });
});
