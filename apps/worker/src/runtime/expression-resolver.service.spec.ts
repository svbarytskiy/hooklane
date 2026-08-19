/// <reference types="jest" />

import { createExecutionRuntimeContext } from "./execution-runtime-context";
import { ExpressionResolverService } from "./expression-resolver.service";

describe("ExpressionResolverService", () => {
  it("resolves explicit roots and retains non-string template values", () => {
    const resolver = new ExpressionResolverService();
    const context = createExecutionRuntimeContext("execution-1", {
      order: { id: "order-42" },
    });
    context.variables.total = 120;
    context.steps.createContact = { output: { body: { id: "crm-123" } } };

    expect(
      resolver.resolveValue(
        {
          order: "{{ event.payload.order }}",
          total: "{{ variables.total }}",
          crmId: "{{ steps.createContact.output.body.id }}",
        },
        context,
      ),
    ).toEqual({
      order: { id: "order-42" },
      total: 120,
      crmId: "crm-123",
    });
  });

  it("keeps old payload paths working while definitions migrate", () => {
    const resolver = new ExpressionResolverService();
    const context = createExecutionRuntimeContext("execution-1", {
      order: { id: "order-42" },
    });

    expect(resolver.resolveExpression("$.order.id", context)).toBe("order-42");
    expect(resolver.resolveExpression("order.id", context)).toBe("order-42");
  });

  it("rejects an unavailable step output clearly", () => {
    const resolver = new ExpressionResolverService();
    const context = createExecutionRuntimeContext("execution-1", {});

    expect(() =>
      resolver.resolveExpression("steps.missing.output.id", context),
    ).toThrow("Expression references unavailable step output: missing");
  });
});
