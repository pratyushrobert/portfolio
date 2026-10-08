import type { RuntimeConfig } from '../config/env.js';

export function loadTestConfig(): RuntimeConfig {
  return {
    NODE_ENV: 'test',
    HOST: '127.0.0.1',
    PORT: 0,
    DATABASE_PATH: ':memory:',
    DATABASE_URL: '',
    DIRECT_URL: '',
    SUPABASE_URL: '',
    SUPABASE_SECRET_KEY: '',
    SUPABASE_STORAGE_BUCKET: 'mimios-assets-test',
    ADMIN_EMAIL: 'admin@test.local',
    ADMIN_PASSWORD: 'a-long-test-password',
    SESSION_SECRET: 'a-session-secret-that-is-at-least-32-chars',
    CORS_ORIGIN: 'http://localhost:5173',
    UPLOAD_MAX_SIZE: 1024 * 1024,
    UPLOAD_DIR: './uploads-test',
    GITHUB_TOKEN: '',
    GITHUB_USERNAME: 'pratyushrobert',
  };
}
