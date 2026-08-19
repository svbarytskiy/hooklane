import { createHash } from "node:crypto";

export const DEFAULT_IDEMPOTENCY_HEADER = "Idempotency-Key";

export function createProviderIdempotencyKey(
  executionId: string,
  stepId: string,
): string {
  const digest = createHash("sha256")
    .update(`${executionId}:${stepId}`)
    .digest("hex");

  return `hl_${digest}`;
}

export function isUnsafeHttpMethod(method: string): boolean {
  return method === "POST" || method === "PATCH";
}
