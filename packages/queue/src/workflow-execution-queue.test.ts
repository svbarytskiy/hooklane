import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateWorkflowBackoff } from "./workflow-execution-queue.js";

describe("calculateWorkflowBackoff", () => {
  it("calculates capped exponential backoff with deterministic jitter", () => {
    assert.equal(
      calculateWorkflowBackoff({
        attemptsMade: 3,
        baseDelayMs: 1_000,
        maxDelayMs: 10_000,
        jitterRatio: 0.25,
        random: () => 1,
      }),
      3_000,
    );
  });

  it("never retries before Retry-After and caps provider delays", () => {
    assert.equal(
      calculateWorkflowBackoff({
        attemptsMade: 1,
        baseDelayMs: 1_000,
        maxDelayMs: 30_000,
        jitterRatio: 0.2,
        retryAfterMs: 12_000,
        random: () => 1,
      }),
      12_000,
    );

    assert.equal(
      calculateWorkflowBackoff({
        attemptsMade: 1,
        baseDelayMs: 1_000,
        maxDelayMs: 30_000,
        jitterRatio: 0,
        retryAfterMs: 60_000,
      }),
      30_000,
    );
  });
});
