import { createWriteStream } from 'node:fs';
import { mkdir, rm, rename, stat } from 'node:fs/promises';
import { basename, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { fileTypeFromFile } from 'file-type';
import { authenticate } from '../middleware/auth.js';
import { validateParams, validateQuery } from '../middleware/validation.js';
import { assetMetadataSchema, assetQuerySchema, idParamSchema } from '../schemas/index.js';
import type { RuntimeConfig } from '../config/env.js';
import type { RouteContext } from './context.js';
import { publicAsset } from './context.js';

const mimeExtensions: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/avif': '.avif',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/ogg': '.ogv',
  'application/pdf': '.pdf',
};

const categoryMime: Record<string, Set<string>> = {
  image: new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif']),
  video: new Set(['video/mp4', 'video/webm', 'video/ogg']),
  document: new Set(['application/pdf']),
};

type UploadFields = Record<string, string>;

function fieldValue(fields: UploadFields, name: string): string | undefined {
  return fields[name];
}

function booleanField(fields: UploadFields, name: string, fallback: boolean): boolean | undefined {
  const value = fieldValue(fields, name);
  if (value === undefined) return fallback;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

function tagsField(fields: UploadFields): string[] | undefined {
  const value = fieldValue(fields, 'tags');
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
    return value.split(',').map((tag) => tag.trim()).filter(Boolean);
  }
  return undefined;
}

function safeUploadPath(uploadDir: string, storedName: string): string | null {
  if (storedName !== basename(storedName) || storedName.includes('..') || storedName.includes('/') || storedName.includes('\\')) {
    return null;
  }
  const root = resolve(uploadDir);
  const target = resolve(root, storedName);
  const relativeTarget = relative(root, target);
  return relativeTarget !== '' && relativeTarget !== '..' && !relativeTarget.startsWith(`..${sep}`) && !isAbsolute(relativeTarget)
    ? target
    : null;
}

function validationError(message: string): { success: false; error: string; code: string } {
  return { success: false, error: message, code: 'VALIDATION_ERROR' };
}

export async function assetRoutes(fastify: FastifyInstance, context: RouteContext & { config: RuntimeConfig }): Promise<void> {
  await mkdir(resolve(context.config.UPLOAD_DIR), { recursive: true });

  fastify.get('/', {
    preValidation: [validateQuery(assetQuerySchema)],
    handler: async (request) => {
      const { category, limit, offset } = request.query as { category?: string; limit: number; offset: number };
      const values: unknown[] = [];
      let query = 'SELECT * FROM assets WHERE visibility = 1';
      if (category) {
        query += ' AND category = ?';
        values.push(category);
      }
      query += ' ORDER BY sort_order, created_at DESC LIMIT ? OFFSET ?';
      values.push(limit, offset);
      const rows = context.database.prepare(query).all(...values) as Array<Record<string, unknown>>;
      return { success: true, data: rows.map(publicAsset) };
    },
  });
}

export async function assetAdminRoutes(fastify: FastifyInstance, context: RouteContext & { config: RuntimeConfig }): Promise<void> {
  await mkdir(resolve(context.config.UPLOAD_DIR), { recursive: true });
  const admin = authenticate(context.authService);

  fastify.get('/', { preHandler: [admin] }, async () => {
    const rows = context.database.prepare('SELECT * FROM assets ORDER BY sort_order, created_at DESC').all() as Array<Record<string, unknown>>;
    return { success: true, data: rows.map(publicAsset) };
  });

  fastify.post('/', {
    preHandler: [admin],
    handler: async (request, reply) => {
      if (!request.isMultipart()) {
        return reply.status(415).send(validationError('Asset uploads must use multipart/form-data'));
      }

      const fields: UploadFields = {};
      let filePart: { filename: string; mimetype: string; file: NodeJS.ReadableStream } | undefined;
      const id = randomUUID();
      const temporaryName = `.${id}.uploading`;
      const temporaryPath = join(resolve(context.config.UPLOAD_DIR), temporaryName);

      try {
        for await (const part of request.parts()) {
          if (part.type === 'file') {
            if (filePart) {
              part.file.resume();
              return reply.status(400).send({ success: false, error: 'Only one file may be uploaded', code: 'VALIDATION_ERROR' });
            }
            filePart = { filename: part.filename, mimetype: part.mimetype, file: part.file };
            await pipeline(part.file, createWriteStream(temporaryPath, { flags: 'wx' }));
            if (part.file.truncated) {
              return reply.status(413).send({ success: false, error: 'Uploaded file is too large', code: 'FILE_TOO_LARGE' });
            }
          } else {
            fields[part.fieldname] = String(part.value);
          }
        }

        if (!filePart) {
          return reply.status(400).send({ success: false, error: 'An asset file is required', code: 'VALIDATION_ERROR' });
        }
        if (filePart.filename.includes('/') || filePart.filename.includes('\\') || filePart.filename.includes('..')) {
          return reply.status(400).send({ success: false, error: 'Invalid filename', code: 'VALIDATION_ERROR' });
        }
        const allowedFields = new Set(['name', 'category', 'featured', 'visibility', 'tags', 'sort_order']);
        const unexpectedFields = Object.keys(fields).filter((field) => !allowedFields.has(field));
        if (unexpectedFields.length > 0) {
          return reply.status(400).send({ success: false, error: 'Unexpected asset metadata field', code: 'VALIDATION_ERROR' });
        }

        const tags = tagsField(fields);
        const metadata = assetMetadataSchema.safeParse({
          name: fieldValue(fields, 'name') ?? filePart.filename,
          category: fieldValue(fields, 'category'),
          featured: booleanField(fields, 'featured', false),
          visibility: booleanField(fields, 'visibility', true),
          tags,
          sort_order: fieldValue(fields, 'sort_order') === undefined ? 0 : Number(fieldValue(fields, 'sort_order')),
        });
        if (!metadata.success) {
          return reply.status(400).send({
            success: false,
            error: 'Invalid asset metadata',
            code: 'VALIDATION_ERROR',
            details: metadata.error.issues,
          });
        }

        const extension = mimeExtensions[filePart.mimetype];
        if (!extension || !categoryMime[metadata.data.category]?.has(filePart.mimetype)) {
          return reply.status(400).send({ success: false, error: 'MIME type does not match an allowed asset category', code: 'VALIDATION_ERROR' });
        }

        const detectedType = await fileTypeFromFile(temporaryPath);
        if (!detectedType || detectedType.mime !== filePart.mimetype) {
          return reply.status(400).send({ success: false, error: 'File contents do not match the declared MIME type', code: 'VALIDATION_ERROR' });
        }

        const storedName = `${id}${extension}`;
        const finalPath = safeUploadPath(context.config.UPLOAD_DIR, storedName);
        if (!finalPath) {
          return reply.status(400).send({ success: false, error: 'Invalid generated filename', code: 'VALIDATION_ERROR' });
        }
        await rename(temporaryPath, finalPath);
        const fileInfo = await stat(finalPath);
        const now = Date.now();
        context.database.prepare(`
          INSERT INTO assets (id, name, category, asset_path, mime_type, size, featured, visibility, tags, sort_order, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, metadata.data.name, metadata.data.category, storedName, filePart.mimetype, fileInfo.size, metadata.data.featured ? 1 : 0,
          metadata.data.visibility ? 1 : 0, JSON.stringify(metadata.data.tags), metadata.data.sort_order, now, now);
        return reply.status(201).send({ success: true, data: publicAsset(context.database.prepare('SELECT * FROM assets WHERE id = ?').get(id) as Record<string, unknown>) });
      } finally {
        await rm(temporaryPath, { force: true });
      }
    },
  });

  fastify.delete('/:id', {
    preHandler: [admin],
    preValidation: [validateParams(idParamSchema)],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const asset = context.database.prepare('SELECT asset_path FROM assets WHERE id = ?').get(id) as { asset_path: string } | undefined;
      if (!asset) {
        return reply.status(404).send({ success: false, error: 'Asset not found', code: 'NOT_FOUND' });
      }
      const filePath = safeUploadPath(context.config.UPLOAD_DIR, asset.asset_path);
      if (!filePath) {
        return reply.status(500).send({ success: false, error: 'Stored asset path is invalid', code: 'ASSET_PATH_INVALID' });
      }
      await rm(filePath, { force: true });
      context.database.prepare('DELETE FROM assets WHERE id = ?').run(id);
      return reply.send({ success: true, message: 'Asset deleted' });
    },
  });
}
