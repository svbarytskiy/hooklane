import { z } from "zod";

export const workerEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().url(),
  WORKFLOW_QUEUE_CONCURRENCY: z.coerce.number().int().positive().default(1),
  WORKFLOW_MAX_ATTEMPTS: z.coerce.number().int().positive().default(3),
  WORKFLOW_BACKOFF_DELAY_MS: z.coerce.number().int().positive().default(1_000),
  WORKFLOW_COMPLETED_RETENTION: z.coerce
    .number()
    .int()
    .positive()
    .default(1_000),
  WORKFLOW_FAILED_RETENTION: z.coerce.number().int().positive().default(5_000),
});

export type WorkerEnv = z.infer<typeof workerEnvSchema>;
