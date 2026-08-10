import { z } from "zod";

export const workerEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().url(),
});

export type WorkerEnv = z.infer<typeof workerEnvSchema>;
