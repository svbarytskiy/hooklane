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
  WORKFLOW_MAX_STEPS: z.coerce.number().int().positive().max(500).default(50),
  WORKFLOW_MAX_DURATION_MS: z.coerce
    .number()
    .int()
    .positive()
    .max(900_000)
    .default(300_000),
  WORKFLOW_STEP_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .max(120_000)
    .default(30_000),
  WORKFLOW_HTTP_ALLOWED_HOSTS: z.string().default("*"),
  WORKFLOW_HTTP_DENIED_HOSTS: z.string().default("localhost,*.local"),
  WORKFLOW_HTTP_MAX_REDIRECTS: z.coerce.number().int().min(0).max(5).default(0),
  WORKFLOW_HTTP_MAX_RESPONSE_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .max(10 * 1024 * 1024)
    .default(1_048_576),
  WORKFLOW_REDACT_KEYS: z
    .string()
    .default(
      "password,token,secret,authorization,api_key,apikey,access_token,refresh_token,client_secret",
    ),
});

export type WorkerEnv = z.infer<typeof workerEnvSchema>;
