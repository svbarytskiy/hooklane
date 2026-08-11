/// <reference types="jest" />

import type { WorkflowDefinition } from "@hooklane/contracts";
import { WorkflowExecutionRunner } from "./workflow-execution.runner";

describe("WorkflowExecutionRunner", () => {
  it("resolves transforms and stops after a false condition", async () => {
    const runner = new WorkflowExecutionRunner();
    const definition: WorkflowDefinition = {
      steps: [
        {
          id: "transform-1",
          name: "copy",
          type: "transform",
          config: { assignments: { normalizedId: "{{order.id}}" } },
        },
        {
          id: "condition-1",
          name: "guard",
          type: "condition",
          config: { expression: 'normalizedId === "missing"' },
        },
        {
          id: "transform-2",
          name: "unreachable",
          type: "transform",
          config: { assignments: { shouldNotExist: "true" } },
        },
      ],
    };
    const steps: string[] = [];

    const result = await runner.run({
      payload: { order: { id: "order-42" } },
      definition,
      onStep: async (step) => {
        steps.push(step.id);
      },
    });

    expect(result.executedSteps).toBe(2);
    expect(steps).toEqual(["transform-1", "condition-1"]);
    expect(result.output).toMatchObject({ normalizedId: "order-42" });
  });

  it("throws for unsuccessful HTTP actions", async () => {
    const runner = new WorkflowExecutionRunner();
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

    await expect(runner.run({ payload: {}, definition })).rejects.toThrow(
      "HTTP step http-1 failed with 503",
    );
    fetchMock.mockRestore();
  });
});
