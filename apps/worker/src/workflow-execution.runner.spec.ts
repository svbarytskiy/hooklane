/// <reference types="jest" />

import type { WorkflowDefinition } from "@hooklane/contracts";

jest.mock("@hooklane/db", () => ({
  createExecutionRepository: jest.fn(),
}));
import { ConditionStepExecutor } from "./runtime/condition-step.executor";
import { DelayStepExecutor } from "./runtime/delay-step.executor";
import { ExpressionResolverService } from "./runtime/expression-resolver.service";
import { HttpRequestStepExecutor } from "./runtime/http-request-step.executor";
import { StepExecutorRegistry } from "./runtime/step-executor.registry";
import { TransformStepExecutor } from "./runtime/transform-step.executor";
import {
  ExecutionCancelledError,
  WorkflowExecutionRunner,
} from "./workflow-execution.runner";

function createRunner() {
  const expressions = new ExpressionResolverService();
  return new WorkflowExecutionRunner(
    new StepExecutorRegistry(
      new TransformStepExecutor(expressions),
      new ConditionStepExecutor(expressions),
      new HttpRequestStepExecutor(
        expressions,
        {
          assertAllowed: jest.fn().mockResolvedValue(undefined),
          assertResponseSize: jest.fn(),
          maxRedirects: 0,
          maxResponseBytes: 1_048_576,
        } as never,
        { redact: (value: unknown) => value } as never,
      ),
      new DelayStepExecutor(),
      { type: "slack_send_message", execute: jest.fn() } as never,
    ),
  );
}

describe("WorkflowExecutionRunner", () => {
  it("keeps event payload immutable, assigns variables, and stops after a false condition", async () => {
    const runner = createRunner();
    const definition: WorkflowDefinition = {
      steps: [
        {
          id: "transform-1",
          name: "copy",
          type: "transform",
          config: {
            assignments: {
              normalizedId: "{{ event.payload.order.id }}",
            },
          },
        },
        {
          id: "condition-1",
          name: "guard",
          type: "condition",
          config: { expression: 'variables.normalizedId === "missing"' },
        },
        {
          id: "transform-2",
          name: "unreachable",
          type: "transform",
          config: { assignments: { shouldNotExist: "true" } },
        },
      ],
    };
    const payload = { order: { id: "order-42" } };
    const outputs: unknown[] = [];
    const skipped: string[] = [];

    const result = await runner.run({
      executionId: "execution-1",
      payload,
      definition,
      lifecycle: {
        onSucceeded: async (_step, _index, output) => {
          outputs.push(output);
        },
        onSkipped: async (step) => {
          skipped.push(step.id);
        },
      },
    });

    expect(result.executedSteps).toBe(2);
    expect(payload).toEqual({ order: { id: "order-42" } });
    expect(result.output.variables).toEqual({ normalizedId: "order-42" });
    expect(result.output.steps["transform-1"]).toEqual({
      output: { assigned: { normalizedId: "order-42" } },
    });
    expect(result.output.steps["condition-1"]).toEqual({
      output: { matched: false },
    });
    expect(outputs).toHaveLength(2);
    expect(skipped).toEqual(["transform-2"]);
  });

  it("makes HTTP response output available to later steps", async () => {
    const runner = createRunner();
    const definition: WorkflowDefinition = {
      steps: [
        {
          id: "http-1",
          name: "create contact",
          type: "http_request",
          config: { url: "https://example.test/contacts", method: "POST" },
        },
        {
          id: "transform-1",
          name: "store contact ID",
          type: "transform",
          config: {
            assignments: {
              crmContactId: "{{ steps.http-1.output.body.id }}",
            },
          },
        },
      ],
    };
    const fetchMock = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ id: "crm-123" }), { status: 201 }),
      );

    const result = await runner.run({
      executionId: "execution-1",
      payload: {},
      definition,
    });

    expect(result.output.variables.crmContactId).toBe("crm-123");
    expect(result.output.steps["http-1"]?.output).toMatchObject({
      status: 201,
      body: { id: "crm-123" },
    });
    fetchMock.mockRestore();
  });

  it("sends one stable provider idempotency key across retries", async () => {
    const runner = createRunner();
    const definition: WorkflowDefinition = {
      steps: [
        {
          id: "create-contact",
          name: "create contact",
          type: "http_request",
          config: {
            url: "https://example.test/contacts",
            method: "POST",
            idempotency: { mode: "execution_step" },
          },
        },
      ],
    };
    const observedKeys: string[] = [];
    const fetchMock = jest.spyOn(globalThis, "fetch").mockImplementation(
      async (_url, init) => {
        observedKeys.push(new Headers(init?.headers).get("Idempotency-Key")!);
        return new Response("{}", { status: 201 });
      },
    );

    await runner.run({
      executionId: "execution-1",
      payload: {},
      definition,
    });
    await runner.run({
      executionId: "execution-1",
      payload: {},
      definition,
    });
    await runner.run({
      executionId: "execution-2",
      payload: {},
      definition,
    });

    expect(observedKeys).toHaveLength(3);
    expect(observedKeys[0]).toMatch(/^hl_[a-f0-9]{64}$/);
    expect(observedKeys[1]).toBe(observedKeys[0]);
    expect(observedKeys[2]).not.toBe(observedKeys[0]);
    fetchMock.mockRestore();
  });

  it("does not retry an ambiguous POST without provider idempotency", async () => {
    const runner = createRunner();
    const definition: WorkflowDefinition = {
      steps: [
        {
          id: "create-contact",
          name: "create contact",
          type: "http_request",
          config: {
            url: "https://example.test/contacts",
            method: "POST",
          },
        },
      ],
    };
    const fetchMock = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("unknown outcome", { status: 503 }));

    await expect(
      runner.run({ executionId: "execution-1", payload: {}, definition }),
    ).rejects.toMatchObject({
      code: "http_ambiguous_result",
      retryable: false,
    });
    fetchMock.mockRestore();
  });

  it("can retry an idempotent POST after an upstream failure", async () => {
    const runner = createRunner();
    const definition: WorkflowDefinition = {
      steps: [
        {
          id: "create-contact",
          name: "create contact",
          type: "http_request",
          config: {
            url: "https://example.test/contacts",
            method: "POST",
            idempotency: { mode: "execution_step" },
          },
        },
      ],
    };
    const fetchMock = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("unavailable", { status: 503 }));

    await expect(
      runner.run({ executionId: "execution-1", payload: {}, definition }),
    ).rejects.toMatchObject({
      code: "http_upstream_error",
      retryable: true,
    });
    fetchMock.mockRestore();
  });

  it("throws for unsuccessful HTTP actions", async () => {
    const runner = createRunner();
    const definition: WorkflowDefinition = {
      steps: [
        {
          id: "http-1",
          name: "request",
          type: "http_request",
          config: { url: "https://example.test/fail", method: "GET" },
        },
      ],
    };
    const fetchMock = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("bad", { status: 503 }));

    await expect(
      runner.run({ executionId: "execution-1", payload: {}, definition }),
    ).rejects.toMatchObject({
        code: "http_upstream_error",
        category: "upstream",
        message: "HTTP step http-1 failed with 503",
        retryable: true,
        httpStatus: 503,
    });
    fetchMock.mockRestore();
  });

  it("classifies rate limiting and preserves Retry-After", async () => {
    const runner = createRunner();
    const definition: WorkflowDefinition = {
      steps: [
        {
          id: "http-1",
          name: "request",
          type: "http_request",
          config: { url: "https://example.test/rate-limit", method: "GET" },
        },
      ],
    };
    const fetchMock = jest.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("slow down", {
        status: 429,
        headers: { "retry-after": "15" },
      }),
    );

    await expect(
      runner.run({ executionId: "execution-1", payload: {}, definition }),
    ).rejects.toMatchObject({
        code: "http_rate_limited",
        category: "rate_limit",
        retryable: true,
        retryAfterMs: 15_000,
    });
    fetchMock.mockRestore();
  });

  it("runs a delay step and persists its output through the lifecycle", async () => {
    const runner = createRunner();
    const completed: unknown[] = [];

    const result = await runner.run({
      executionId: "execution-1",
      payload: {},
      definition: {
        steps: [
          {
            id: "delay-1",
            name: "wait",
            type: "delay",
            config: { durationMs: 1 },
          },
        ],
      },
      lifecycle: {
        onSucceeded: async (_step, _index, output) => {
          completed.push(output);
        },
      },
    });

    expect(result.executedSteps).toBe(1);
    expect(completed).toEqual([{ durationMs: 1 }]);
  });

  it("resumes from a durable checkpoint without replaying completed steps", async () => {
    const runner = createRunner();
    const started: string[] = [];

    const result = await runner.run({
      executionId: "execution-1",
      payload: {},
      definition: {
        steps: [
          {
            id: "already-completed",
            name: "already completed",
            type: "transform",
            config: { assignments: { customerId: "wrong-value" } },
          },
          {
            id: "resume-here",
            name: "resume here",
            type: "transform",
            config: {
              assignments: {
                copiedCustomerId: "{{ variables.customerId }}",
              },
            },
          },
        ],
      },
      startStepIndex: 1,
      checkpoint: {
        variables: { customerId: "customer-42" },
        steps: {
          "already-completed": { output: { customerId: "customer-42" } },
        },
      },
      lifecycle: {
        onStarted: async (step) => {
          started.push(step.id);
        },
      },
    });

    expect(started).toEqual(["resume-here"]);
    expect(result.output.variables).toMatchObject({
      customerId: "customer-42",
      copiedCustomerId: "customer-42",
    });
  });

  it("rejects a workflow that exceeds the configured step limit", async () => {
    const runner = createRunner();

    await expect(
      runner.run({
        executionId: "execution-1",
        payload: {},
        definition: {
          steps: [
            {
              id: "one",
              name: "one",
              type: "delay",
              config: { durationMs: 1 },
            },
            {
              id: "two",
              name: "two",
              type: "delay",
              config: { durationMs: 1 },
            },
          ],
        },
        limits: { maxSteps: 1, maxDurationMs: 1_000, stepTimeoutMs: 100 },
      }),
    ).rejects.toThrow("limit is 1");
  });

  it("stops before a step when cancellation was requested", async () => {
    const runner = createRunner();

    await expect(
      runner.run({
        executionId: "execution-1",
        payload: {},
        definition: {
          steps: [
            {
              id: "wait",
              name: "wait",
              type: "delay",
              config: { durationMs: 1 },
            },
          ],
        },
        isCancellationRequested: async () => true,
      }),
    ).rejects.toBeInstanceOf(ExecutionCancelledError);
  });
});
