import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { WorkflowStep } from "@hooklane/contracts";
import type { WorkerEnv } from "../config/env.schema";

const builtInSensitiveKeys = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "proxy-authorization",
  "x-api-key",
  "api-key",
]);

@Injectable()
export class ExecutionDataSanitizerService {
  private readonly redactKeys: Set<string>;

  constructor(config: ConfigService<WorkerEnv, true>) {
    this.redactKeys = new Set([
      ...builtInSensitiveKeys,
      ...config
        .get("WORKFLOW_REDACT_KEYS", { infer: true })
        .split(",")
        .map((key) => key.trim().toLowerCase())
        .filter(Boolean),
    ]);
  }

  stepInput(step: WorkflowStep): unknown {
    return { type: step.type, config: this.redact(step.config) };
  }

  redact(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((item) => this.redact(item));
    if (!value || typeof value !== "object") return value;

    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        this.isSensitiveKey(key)
          ? "[REDACTED]"
          : this.redactUrlIfNeeded(key, this.redact(child)),
      ]),
    );
  }

  private redactUrlIfNeeded(key: string, value: unknown): unknown {
    if (key.toLowerCase() !== "url" || typeof value !== "string") {
      return value;
    }

    try {
      const url = new URL(value);
      let wasRedacted = false;
      for (const [parameter] of url.searchParams) {
        if (this.isSensitiveKey(parameter)) {
          url.searchParams.set(parameter, "[REDACTED]");
          wasRedacted = true;
        }
      }
      return wasRedacted ? url.toString() : value;
    } catch {
      return value;
    }
  }

  private isSensitiveKey(key: string): boolean {
    const normalized = key.toLowerCase();
    return (
      this.redactKeys.has(normalized) ||
      normalized.includes("secret") ||
      normalized.includes("password") ||
      normalized.includes("token")
    );
  }
}
