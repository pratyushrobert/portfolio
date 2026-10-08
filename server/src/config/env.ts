import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { z } from 'zod';

export const serverRoot = fileURLToPath(new URL('../../', import.meta.url));

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  DATABASE_URL: z.string().trim().optional().default(''),
  DIRECT_URL: z.string().trim().optional().default(''),
  SUPABASE_URL: z.string().trim().optional().default(''),
  SUPABASE_SECRET_KEY: z.string().trim().optional().default(''),
  SUPABASE_STORAGE_BUCKET: z.string().trim().default('mimios-assets'),
  DATABASE_PATH: z.string().min(1).default('./data/mimios.db'),
  ADMIN_EMAIL: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  ADMIN_PASSWORD: z.string().min(12).refine((value) => Buffer.byteLength(value) <= 72, 'Password must be at most 72 UTF-8 bytes')
    .refine((value) => !value.startsWith('replace-'), 'Replace the example password'),
  SESSION_SECRET: z.string().min(32).max(512).refine((value) => !value.startsWith('replace-'), 'Replace the example secret'),
  CORS_ORIGIN: z.string().default('http://localhost:5173').refine((value) => value.split(',').every((origin) => {
    try {
      const url = new URL(origin.trim());
      return ['http:', 'https:'].includes(url.protocol) && url.origin === origin.trim();
    } catch {
      return false;
    }
  }), 'Use explicit HTTP(S) origins separated by commas, without paths or wildcards'),
  UPLOAD_MAX_SIZE: z.coerce.number().int().min(1).max(100 * 1024 * 1024).default(50 * 1024 * 1024),
  UPLOAD_DIR: z.string().min(1).default('./uploads'),
  GITHUB_TOKEN: z.string().trim().optional().default(''),
  GITHUB_USERNAME: z.string().trim().min(1).default('pratyushrobert'),
});

export type RuntimeConfig = z.infer<typeof configSchema>;

export function loadConfig(source: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const parsed = configSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Invalid server environment: ${parsed.error.issues.map((issue) => issue.path.join('.')).join(', ')}`);
  }
  const dbUrl = parsed.data.DATABASE_URL || parsed.data.DIRECT_URL || '';
  return {
    ...parsed.data,
    DATABASE_URL: dbUrl,
    DATABASE_PATH: parsed.data.DATABASE_PATH === ':memory:' ? ':memory:' : resolve(serverRoot, parsed.data.DATABASE_PATH),
    UPLOAD_DIR: resolve(serverRoot, parsed.data.UPLOAD_DIR),
  };
}

export function loadEnvironment(): RuntimeConfig {
  dotenv.config({ path: resolve(serverRoot, '.env') });
  return loadConfig();
}
