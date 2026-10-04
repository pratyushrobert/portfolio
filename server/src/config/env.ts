import dotenv from 'dotenv';

dotenv.config();

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3001', 10),
  DATABASE_PATH: process.env.DATABASE_PATH || './data/mimios.db',
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'admin@mimios.local',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'mimiisbest@1@',
  SESSION_SECRET: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
  UPLOAD_MAX_SIZE: parseInt(process.env.UPLOAD_MAX_SIZE || '52428800', 10),
  UPLOAD_DIR: process.env.UPLOAD_DIR || './uploads',
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3001', 10),
} as const;

export type Env = typeof env;