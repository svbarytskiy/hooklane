export type StepRuntimeState = {
  output: unknown;
};

export type ExecutionRuntimeContext = {
  execution: {
    id: string;
  };
  event: {
    payload: unknown;
  };
  variables: Record<string, unknown>;
  steps: Record<string, StepRuntimeState>;
};

export type ExecutionCheckpoint = Pick<
  ExecutionRuntimeContext,
  "variables" | "steps"
>;

export function createExecutionRuntimeContext(
  executionId: string,
  payload: unknown,
  checkpoint?: ExecutionCheckpoint,
): ExecutionRuntimeContext {
  return {
    execution: { id: executionId },
    event: { payload },
    variables: { ...checkpoint?.variables },
    steps: { ...checkpoint?.steps },
  };
}

export function setRuntimePath(
  target: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  const segments = path.split(".");
  if (
    segments.some(
      (segment) =>
        segment.length === 0 ||
        ["__proto__", "prototype", "constructor"].includes(segment),
    )
  ) {
    throw new Error(`Transform assignment path ${path} is unsafe`);
  }

  let cursor = target;
  for (const segment of segments.slice(0, -1)) {
    const child = Object.hasOwn(cursor, segment) ? cursor[segment] : undefined;
    if (!isRecord(child)) cursor[segment] = {};
    cursor = cursor[segment] as Record<string, unknown>;
  }

  cursor[segments[segments.length - 1]] = value;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
