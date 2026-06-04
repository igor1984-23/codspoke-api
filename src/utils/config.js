// =============================================================================
// Environment config — load & validate once
// =============================================================================

import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().default('*'),
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),
  RESEND_API_KEY: z.string().optional(),
  EDSOFA_API_KEY: z.string().optional(),
  EDSOFA_WEBHOOK_SECRET: z.string().optional(),
});

export const config = schema.parse(process.env);
