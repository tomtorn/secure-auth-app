import { z } from 'zod';
import { config as dotenvConfig } from 'dotenv';

// Load .env file before parsing environment variables
dotenvConfig();

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string(),
  DIRECT_URL: z.string(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  // In production, FRONTEND_URL must be explicitly set (no default)
  // In development, defaults to localhost
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  // CSRF token signing secret - required in production
  // Security: Used to sign CSRF tokens so they can be validated without cookies
  CSRF_SECRET: z.string().min(32).optional(),
  // Redis URL for distributed rate limiting (optional, falls back to in-memory)
  REDIS_URL: z.string().url().optional(),
  // Supabase webhook secret for verifying incoming webhooks
  SUPABASE_WEBHOOK_SECRET: z.string().min(32).optional(),
  // Sentry DSN for error tracking (optional)
  SENTRY_DSN: z.string().url().optional(),
});

// Additional validation: in production, require explicit values
const validateProductionConfig = (env: z.infer<typeof envSchema>): void => {
  if (env.NODE_ENV === 'production') {
    if (env.FRONTEND_URL === 'http://localhost:5173') {
      console.error('FATAL: FRONTEND_URL must be explicitly set in production');
      process.exit(1);
    }
    if (!env.CSRF_SECRET) {
      console.error('FATAL: CSRF_SECRET must be set in production (min 32 chars)');
      process.exit(1);
    }
  }
};

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const env = parsed.data;

// Validate production-specific requirements
validateProductionConfig(env);

// Generate a dev-only CSRF secret (NOT for production!)
const DEV_CSRF_SECRET = 'dev-only-csrf-secret-do-not-use-in-production-32chars!';

export const config = {
  port: env.PORT,
  isProd: env.NODE_ENV === 'production',
  isDev: env.NODE_ENV === 'development',
  frontendUrl: env.FRONTEND_URL,
  supabase: {
    url: env.SUPABASE_URL,
    anonKey: env.SUPABASE_ANON_KEY,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  },
  // Security: CSRF secret for signing tokens (required in prod)
  csrfSecret: env.CSRF_SECRET ?? DEV_CSRF_SECRET,
  // Redis URL for distributed rate limiting
  redisUrl: env.REDIS_URL,
  // Supabase webhook secret for verifying incoming webhooks
  supabaseWebhookSecret: env.SUPABASE_WEBHOOK_SECRET,
  // Sentry DSN for error tracking
  sentryDsn: env.SENTRY_DSN,
  auth: {
    lockout: {
      maxAttempts: 5,
      durationMs: 15 * 60 * 1000,
    },
    rateLimit: {
      windowMs: 60 * 1000,
      maxRequests: 5,
    },
    session: {
      cookieMaxAge: 86400,
      refreshMaxAge: 30 * 86400,
    },
  },
} as const;

export type Config = typeof config;
