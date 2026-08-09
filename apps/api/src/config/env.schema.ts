import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),

  PORT: z.coerce.number().int().positive().default(3000),

  API_URL: z.string().url(),
  WEB_URL: z.string().url(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().url(),

  WEBHOOK_SECRETS_ENCRYPTION_KEY: z
    .string()
    .min(1)
    .refine(
      (value) => Buffer.from(value, 'base64').length === 32,
      'Must be a base64-encoded 32-byte key',
    ),
  WEBHOOK_SIGNATURE_TOLERANCE_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(300),
  WEBHOOK_RATE_LIMIT_MAX_REQUESTS: z.coerce
    .number()
    .int()
    .positive()
    .default(60),
  WEBHOOK_RATE_LIMIT_WINDOW_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(60),
  WEBHOOK_PAYLOAD_RETENTION_DAYS: z.coerce
    .number()
    .int()
    .positive()
    .default(30),
  WEBHOOK_REDACT_KEYS: z
    .string()
    .default(
      'password,token,secret,authorization,api_key,apikey,access_token,refresh_token,client_secret',
    ),

  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),

  STRIPE_CREDITS_PRICE_ID: z.string().min(1),
  STRIPE_PRO_MONTHLY_PRICE_ID: z.string().min(1),
});

export type Env = z.infer<typeof envSchema>;
