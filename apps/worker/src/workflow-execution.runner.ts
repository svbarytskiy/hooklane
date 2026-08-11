import type { WorkflowDefinition, WorkflowStep } from "@hooklane/contracts";
import { Injectable } from "@nestjs/common";

type RunnerInput = {
  payload: unknown;
  definition: unknown;
  onStep?: (
    step: WorkflowStep,
    index: number,
    output: unknown,
  ) => Promise<void>;
};

type RunnerResult = {
  output: unknown;
  executedSteps: number;
};

type RuntimeState = {
  payload: unknown;
  data: Record<string, unknown>;
  lastResponse?: unknown;
};

@Injectable()
export class WorkflowExecutionRunner {
  async run(input: RunnerInput): Promise<RunnerResult> {
    const definition = this.parseDefinition(input.definition);
    const state: RuntimeState = {
      payload: input.payload,
      data: this.toRecord(input.payload),
    };
    let executedSteps = 0;

    for (const step of definition.steps) {
      const shouldContinue = await this.executeStep(step, state);
      executedSteps += 1;
      await input.onStep?.(step, executedSteps - 1, state.data);

      if (!shouldContinue) {
        break;
      }
    }

    return { output: state.data, executedSteps };
  }

  private async executeStep(
    step: WorkflowStep,
    state: RuntimeState,
  ): Promise<boolean> {
    switch (step.type) {
      case "transform":
        for (const [field, expression] of Object.entries(
          step.config.assignments,
        )) {
          this.setPath(state.data, field, this.resolveValue(expression, state));
        }
        return true;
      case "condition":
        return this.evaluateCondition(step.config.expression, state);
      case "http_request":
        state.lastResponse = await this.executeHttpRequest(step, state);
        return true;
    }
  }

  private async executeHttpRequest(
    step: Extract<WorkflowStep, { type: "http_request" }>,
    state: RuntimeState,
  ): Promise<unknown> {
    const body = step.config.body
      ? this.resolveValue(step.config.body, state)
      : undefined;
    const response = await fetch(step.config.url, {
      method: step.config.method,
      headers: {
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...step.config.headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });

    const responseText = await response.text();
    if (!response.ok) {
      throw new Error(
        `HTTP step ${step.id} failed with ${response.status}: ${responseText.slice(0, 500)}`,
      );
    }

    try {
      return responseText ? JSON.parse(responseText) : null;
    } catch {
      return responseText;
    }
  }

  private evaluateCondition(expression: string, state: RuntimeState): boolean {
    const match = expression.match(/^(.+?)\s*(===|!==|==|!=)\s*(.+)$/);
    if (!match) {
      return Boolean(this.resolveExpression(expression, state));
    }

    const left = this.resolveExpression(match[1], state);
    const right = this.resolveExpression(match[3], state);
    return match[2] === "===" || match[2] === "=="
      ? left === right
      : left !== right;
  }

  private resolveValue(value: unknown, state: RuntimeState): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.resolveValue(item, state));
    }

    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value).map(([key, child]) => [
          key,
          this.resolveValue(child, state),
        ]),
      );
    }

    if (typeof value !== "string") {
      return value;
    }

    const template = value.match(/^\{\{\s*(.+?)\s*\}\}$/);
    return template ? this.resolveExpression(template[1], state) : value;
  }

  private resolveExpression(expression: string, state: RuntimeState): unknown {
    const normalized = expression.trim();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
    if (normalized === "null") return null;
    if (/^-?\d+(\.\d+)?$/.test(normalized)) return Number(normalized);
    if (
      (normalized.startsWith('"') && normalized.endsWith('"')) ||
      (normalized.startsWith("'") && normalized.endsWith("'"))
    ) {
      return normalized.slice(1, -1);
    }

    const path = normalized.replace(/^(\$|payload|data)\.?/, "");
    return this.getPath(state.data, path);
  }

  private parseDefinition(value: unknown): WorkflowDefinition {
    if (
      !value ||
      typeof value !== "object" ||
      !Array.isArray((value as { steps?: unknown }).steps)
    ) {
      throw new Error("Workflow definition is invalid at execution time");
    }

    return value as WorkflowDefinition;
  }

  private toRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? { ...(value as Record<string, unknown>) }
      : { value };
  }

  private getPath(value: Record<string, unknown>, path: string): unknown {
    if (!path) return value;
    return path.split(".").reduce<unknown>((current, key) => {
      if (!current || typeof current !== "object") return undefined;
      return (current as Record<string, unknown>)[key];
    }, value);
  }

  private setPath(
    value: Record<string, unknown>,
    path: string,
    nextValue: unknown,
  ): void {
    const keys = path.split(".").filter(Boolean);
    if (keys.length === 0) return;
    let cursor = value;
    for (const key of keys.slice(0, -1)) {
      const child = cursor[key];
      if (!child || typeof child !== "object" || Array.isArray(child)) {
        cursor[key] = {};
      }
      cursor = cursor[key] as Record<string, unknown>;
    }
    cursor[keys[keys.length - 1]] = nextValue;
  }
}
