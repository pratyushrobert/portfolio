import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { fileTypeFromBuffer } from 'file-type';
import { authenticate } from '../middleware/auth.js';
import { validateParams, validateQuery } from '../middleware/validation.js';
import { assetMetadataSchema, assetQuerySchema, idParamSchema } from '../schemas/index.js';
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

function validationError(message: string): { success: false; error: string; code: string } {
  return { success: false, error: message, code: 'VALIDATION_ERROR' };
}

export async function assetRoutes(fastify: FastifyInstance, context: RouteContext): Promise<void> {
  fastify.get('/', {
    preValidation: [validateQuery(assetQuerySchema)],
    handler: async (request) => {
      const { category, limit, offset } = request.query as { category?: string; limit: number; offset: number };
      const values: unknown[] = [];
      let query = 'SELECT * FROM assets WHERE visibility = 1';
      if (category) {
        values.push(category);
        query += ` AND category = $${values.length}`;
      }
      values.push(limit);
      query += ` ORDER BY sort_order, created_at DESC LIMIT $${values.length}`;
      values.push(offset);
      query += ` OFFSET $${values.length}`;

      const rows = await context.database.queryAll<Record<string, unknown>>(query, values);
      return { success: true, data: rows.map((r) => publicAsset(r, context.storageService)) };
    },
  });
}

export async function assetAdminRoutes(fastify: FastifyInstance, context: RouteContext): Promise<void> {
  const admin = authenticate(context.authService);

  fastify.get('/', { preHandler: [admin] }, async () => {
    const rows = await context.database.queryAll<Record<string, unknown>>(
      'SELECT * FROM assets ORDER BY sort_order, created_at DESC'
    );
    return { success: true, data: rows.map((r) => publicAsset(r, context.storageService)) };
  });

  fastify.post('/', {
    preHandler: [admin],
    handler: async (request, reply) => {
      if (!request.isMultipart()) {
        return reply.status(415).send(validationError('Asset uploads must use multipart/form-data'));
      }

      const fields: UploadFields = {};
      let filePart: { filename: string; mimetype: string; buffer: Buffer } | undefined;
      const id = randomUUID();

      for await (const part of request.parts()) {
        if (part.type === 'file') {
          if (filePart) {
            part.file.resume();
            return reply.status(400).send({ success: false, error: 'Only one file may be uploaded', code: 'VALIDATION_ERROR' });
          }
          const chunks: Buffer[] = [];
          for await (const chunk of part.file) {
            chunks.push(chunk as Buffer);
          }
          const buffer = Buffer.concat(chunks);
          if (part.file.truncated || buffer.length > context.config.UPLOAD_MAX_SIZE) {
            return reply.status(413).send({ success: false, error: 'Uploaded file is too large', code: 'FILE_TOO_LARGE' });
          }
          filePart = { filename: part.filename, mimetype: part.mimetype, buffer };
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

      const detectedType = await fileTypeFromBuffer(filePart.buffer);
      if (!detectedType || detectedType.mime !== filePart.mimetype) {
        return reply.status(400).send({ success: false, error: 'File contents do not match the declared MIME type', code: 'VALIDATION_ERROR' });
      }

      const storedName = `${id}${extension}`;

      // Upload to Supabase Storage (or local storage fallback)
      await context.storageService.upload(storedName, filePart.buffer, filePart.mimetype);

      const now = Date.now();
      await context.database.execute(`
        INSERT INTO assets (id, name, category, asset_path, mime_type, size, featured, visibility, tags, sort_order, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        id, metadata.data.name, metadata.data.category, storedName, filePart.mimetype,
        filePart.buffer.length, metadata.data.featured ? 1 : 0, metadata.data.visibility ? 1 : 0,
        JSON.stringify(metadata.data.tags), metadata.data.sort_order, now, now
      ]);

      const created = await context.database.queryOne<Record<string, unknown>>('SELECT * FROM assets WHERE id = $1', [id]);
      return reply.status(201).send({ success: true, data: publicAsset(created as Record<string, unknown>, context.storageService) });
    },
  });

  fastify.delete('/:id', {
    preHandler: [admin],
    preValidation: [validateParams(idParamSchema)],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const asset = await context.database.queryOne<{ asset_path: string }>('SELECT asset_path FROM assets WHERE id = $1', [id]);
      if (!asset) {
        return reply.status(404).send({ success: false, error: 'Asset not found', code: 'NOT_FOUND' });
      }

      try {
        await context.storageService.delete(asset.asset_path);
      } catch (err: unknown) {
        request.log.warn({ err }, 'Storage delete warning');
      }

      const result = await context.database.execute('DELETE FROM assets WHERE id = $1', [id]);
      if (result.rowCount === 0) {
        return reply.status(404).send({ success: false, error: 'Asset not found', code: 'NOT_FOUND' });
      }
      return reply.send({ success: true, message: 'Asset deleted' });
    },
  });
}
