import { workerEnvSchema } from "./env.schema";

export function validateWorkerEnv(config: Record<string, unknown>) {
  const parsed = workerEnvSchema.safeParse(config);

  if (!parsed.success) {
    const errors = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    throw new Error(`Invalid worker environment variables:\n${errors}`);
  }

  return parsed.data;
}
