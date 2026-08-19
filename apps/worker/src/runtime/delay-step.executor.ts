import type { DelayStep } from "@hooklane/contracts";
import { Injectable } from "@nestjs/common";
import type { ExecutionRuntimeContext } from "./execution-runtime-context";
import type { StepExecutionResult, StepExecutor } from "./step-executor.types";

@Injectable()
export class DelayStepExecutor implements StepExecutor<DelayStep> {
  readonly type = "delay" as const;

  async execute(
    step: DelayStep,
    _context: ExecutionRuntimeContext,
    signal: AbortSignal,
  ): Promise<StepExecutionResult> {
    await this.sleep(step.config.durationMs, signal);
    return {
      output: { durationMs: step.config.durationMs },
      shouldContinue: true,
    };
  }

  private sleep(durationMs: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const resources: { timeout?: NodeJS.Timeout } = {};
      const cleanup = () => {
        if (resources.timeout) clearTimeout(resources.timeout);
        signal.removeEventListener("abort", onAbort);
      };
      const onAbort = () => {
        cleanup();
        reject(
          signal.reason instanceof Error
            ? signal.reason
            : new Error("Delay step was cancelled"),
        );
      };

      resources.timeout = setTimeout(() => {
        cleanup();
        resolve();
      }, durationMs);

      if (signal.aborted) {
        onAbort();
        return;
      }

      signal.addEventListener("abort", onAbort, { once: true });
    });
  }
}
