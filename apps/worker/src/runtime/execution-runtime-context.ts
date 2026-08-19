export type StepRuntimeState = {
  output: unknown;
};

export type ExecutionRuntimeContext = {
  event: {
    payload: unknown;
  };
  variables: Record<string, unknown>;
  steps: Record<string, StepRuntimeState>;
};

export function createExecutionRuntimeContext(
  payload: unknown,
): ExecutionRuntimeContext {
  return {
    event: { payload },
    variables: {},
    steps: {},
  };
}

export function setRuntimePath(
  target: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  const segments = path.split(".").filter(Boolean);
  if (segments.length === 0) {
    throw new Error("Transform assignment path cannot be empty");
  }

  let cursor = target;
  for (const segment of segments.slice(0, -1)) {
    const child = cursor[segment];
    if (!isRecord(child)) cursor[segment] = {};
    cursor = cursor[segment] as Record<string, unknown>;
  }

  cursor[segments[segments.length - 1]] = value;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
