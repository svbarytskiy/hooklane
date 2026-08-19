import { Injectable } from "@nestjs/common";
import {
  type ExecutionRuntimeContext,
  isRecord,
} from "./execution-runtime-context";

const fullTemplatePattern = /^\{\{\s*(.+?)\s*\}\}$/;

@Injectable()
export class ExpressionResolverService {
  resolveValue(value: unknown, context: ExecutionRuntimeContext): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.resolveValue(item, context));
    }

    if (isRecord(value)) {
      return Object.fromEntries(
        Object.entries(value).map(([key, child]) => [
          key,
          this.resolveValue(child, context),
        ]),
      );
    }

    if (typeof value !== "string") return value;

    const template = value.match(fullTemplatePattern);
    return template ? this.resolveExpression(template[1], context) : value;
  }

  resolveExpression(
    expression: string,
    context: ExecutionRuntimeContext,
  ): unknown {
    const normalized = expression.trim();
    const literal = this.resolveLiteral(normalized);
    if (literal.resolved) return literal.value;

    const path = this.normalizePath(normalized);
    return this.resolvePath(path, context);
  }

  private resolveLiteral(
    expression: string,
  ): { resolved: true; value: unknown } | { resolved: false } {
    if (expression === "true") return { resolved: true, value: true };
    if (expression === "false") return { resolved: true, value: false };
    if (expression === "null") return { resolved: true, value: null };
    if (/^-?\d+(\.\d+)?$/.test(expression)) {
      return { resolved: true, value: Number(expression) };
    }
    if (
      (expression.startsWith('"') && expression.endsWith('"')) ||
      (expression.startsWith("'") && expression.endsWith("'"))
    ) {
      return { resolved: true, value: expression.slice(1, -1) };
    }
    return { resolved: false };
  }

  private normalizePath(expression: string): string[] {
    if (expression === "$") return ["event", "payload"];
    if (expression.startsWith("$.")) {
      return ["event", "payload", ...this.splitPath(expression.slice(2))];
    }
    if (expression === "payload") return ["event", "payload"];
    if (expression.startsWith("payload.")) {
      return ["event", "payload", ...this.splitPath(expression.slice(8))];
    }

    const segments = this.splitPath(expression);
    if (
      ["execution", "event", "variables", "steps"].includes(segments[0] ?? "")
    ) {
      return segments;
    }

    // Compatibility for definitions created before the explicit context model.
    return ["legacy", ...segments];
  }

  private resolvePath(
    path: string[],
    context: ExecutionRuntimeContext,
  ): unknown {
    if (path[0] === "legacy") {
      const variableValue = this.getPath(context.variables, path.slice(1));
      return variableValue === undefined
        ? this.getPath(context.event.payload, path.slice(1))
        : variableValue;
    }

    if (path[0] === "steps" && path.length >= 2 && !context.steps[path[1]]) {
      throw new Error(
        `Expression references unavailable step output: ${path[1]}`,
      );
    }

    const value = this.getPath(context, path);
    if (value === undefined) {
      throw new Error(`Expression could not be resolved: ${path.join(".")}`);
    }
    return value;
  }

  private splitPath(path: string): string[] {
    const segments = path.split(".").filter(Boolean);
    if (segments.length === 0)
      throw new Error("Expression path cannot be empty");
    return segments;
  }

  private getPath(value: unknown, path: string[]): unknown {
    return path.reduce<unknown>((current, segment) => {
      if (Array.isArray(current) && /^\d+$/.test(segment)) {
        return current[Number(segment)];
      }
      return isRecord(current) ? current[segment] : undefined;
    }, value);
  }
}
