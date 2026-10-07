import { z } from 'zod';

const httpUrl = z.string()
  .max(2048)
  .url('Must be a valid URL')
  .refine((value) => value.startsWith('http://') || value.startsWith('https://'), 'Only HTTP(S) URLs are allowed');

const boundedString = (max: number) => z.string().trim().min(1).max(max);

export const idParamSchema = z.object({
  id: z.string().uuid('Invalid ID format'),
}).strict();

export const keyParamSchema = z.object({
  key: z.string().regex(/^[A-Za-z0-9_.-]{1,100}$/, 'Invalid key format'),
}).strict();

export const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
}).strict();

export const assetQuerySchema = listQuerySchema.extend({
  category: z.enum(['image', 'video', 'document']).optional(),
}).strict();

export const loginSchema = z.object({
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  password: z.string().min(1).max(512),
}).strict();

export const projectCreateSchema = z.object({
  name: boundedString(200),
  description: z.string().max(500).default(''),
  long_description: z.string().max(10000).nullable().optional(),
  technologies: z.array(boundedString(50)).max(50).default([]),
  github_url: httpUrl.nullable().optional(),
  live_url: httpUrl.nullable().optional(),
  featured_image: z.string().trim().max(2048).nullable().optional(),
  visibility: z.enum(['public', 'hidden']).default('public'),
  featured: z.boolean().default(false),
  sort_order: z.number().int().min(0).max(100000).default(0),
  github_repo: z.string().trim().max(200).nullable().optional(),
}).strict();

export const projectUpdateSchema = projectCreateSchema.partial().strict();

export const projectSyncSchema = z.object({
  github_repo: z.string().trim().max(200).optional(),
}).strict().optional();

export const repoContentsQuerySchema = z.object({
  path: z.string().max(1024).optional().default(''),
  ref: z.string().max(100).optional(),
}).strict();

export const repoFileQuerySchema = z.object({
  path: z.string().min(1).max(1024),
  ref: z.string().max(100).optional(),
}).strict();

export const repoParamSchema = z.object({
  repo: z.string().regex(/^[a-zA-Z0-9_.-]+$/, 'Invalid repository name'),
}).strict();

export const repoListQuerySchema = z.object({
  refresh: z.preprocess((val) => val === 'true' || val === true, z.boolean()).optional(),
}).strict();

const skillCategory = z.enum(['programming', 'cybersecurity', 'web', 'tools', 'infrastructure', 'databases', 'other']);
const skillLevel = z.enum(['beginner', 'intermediate', 'advanced', 'expert']);

export const skillCreateSchema = z.object({
  name: boundedString(100),
  category: skillCategory,
  level: skillLevel.nullable().optional(),
  sort_order: z.number().int().min(0).max(100000).default(0),
  visibility: z.boolean().default(true),
}).strict();

export const skillUpdateSchema = skillCreateSchema.partial().strict();

const portfolioDate = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])(?:-(0[1-9]|[12]\d|3[01]))?$/, 'Invalid date format')
  .refine((value) => {
    const parts = value.split('-');
    const year = Number(parts[0]);
    const month = Number(parts[1]);
    const day = parts[2] === undefined ? 1 : Number(parts[2]);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }, 'Invalid calendar date');

export const experienceCreateSchema = z.object({
  organization: boundedString(200),
  role: boundedString(150),
  start_date: portfolioDate,
  end_date: portfolioDate.nullable().optional(),
  description: z.string().max(5000).default(''),
  technologies: z.array(boundedString(50)).max(50).default([]),
  link: httpUrl.nullable().optional(),
  sort_order: z.number().int().min(0).max(100000).default(0),
  visibility: z.boolean().default(true),
}).strict();

export const experienceUpdateSchema = experienceCreateSchema.partial().strict();

export const certificateCreateSchema = z.object({
  name: boundedString(200),
  issuer: boundedString(200),
  date: portfolioDate,
  description: z.string().max(5000).nullable().optional(),
  asset_id: z.string().uuid().nullable().optional(),
  link: httpUrl.nullable().optional(),
  sort_order: z.number().int().min(0).max(100000).default(0),
  visibility: z.boolean().default(true),
}).strict();

export const certificateUpdateSchema = certificateCreateSchema.partial().strict();

export const portfolioPatchSchema = z.object({
  key: z.string().regex(/^[A-Za-z0-9_.-]{1,100}$/),
  content: z.string().max(100000),
}).strict();

export const configKeySchema = z.object({
  key: z.string().regex(/^[A-Za-z0-9_.-]{1,100}$/),
}).strict();

export const configSinglePatchSchema = z.object({
  key: z.string().regex(/^[A-Za-z0-9_.-]{1,100}$/),
  value: z.string().max(10000),
  description: z.string().max(500).nullable().optional(),
}).strict();

export const configBatchPatchSchema = z.array(configSinglePatchSchema).min(1).max(100);

export const configPatchSchema = z.union([configSinglePatchSchema, configBatchPatchSchema]);

export const assetMetadataSchema = z.object({
  name: boundedString(200).refine((value) => !value.includes('/') && !value.includes('\\') && !value.includes('..'), 'Asset name contains an invalid path'),
  category: z.enum(['image', 'video', 'document']),
  featured: z.boolean(),
  visibility: z.boolean(),
  tags: z.array(boundedString(50)).max(50),
  sort_order: z.number().int().min(0).max(100000),
}).strict();
