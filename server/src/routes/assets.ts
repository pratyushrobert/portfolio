import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { randomUUID } from 'crypto';
import path from 'path';
import { unlink } from 'fs/promises';

const assetSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.enum(['image', 'video', 'document']),
  mime_type: z.string().min(1),
  size: z.number().int().positive().optional(),
  featured: z.boolean().default(false),
  visibility: z.boolean().default(true),
  tags: z.array(z.string()).default([]),
  sort_order: z.number().int().min(0).default(0),
});

export async function assetRoutes(fastify: FastifyInstance) {
  fastify.get('/', async (request, reply) => {
    const { category, limit = 50, offset = 0 } = request.query as any;
    let query = 'SELECT * FROM assets WHERE visibility = 1';
    const params: any[] = [];

    if (request.query.category) {
      query += ' AND category = ?';
      params.push(request.query.category);
    }

    query += ' ORDER BY sort_order, created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(request.query.limit as string) || 50, parseInt(request.query.offset as string) || 0);

    const assets = db.prepare(query).all(...params);
    return { success: true, data: assets };
  });

  fastify.get('/admin', { preHandler: [authenticate, requireRole('admin')] }, async (request, reply) => {
    const assets = db.prepare('SELECT * FROM assets ORDER BY sort_order, created_at DESC').all();
    return { success: true, data: assets };
  });

  fastify.post('/admin', { preHandler: [authenticate, requireRole('admin')] }, async (request, reply) => {
    const { name, category, mime_type, size, featured, visibility, tags, sort_order } = request.body as any;
    const id = crypto.randomUUID();
    const now = Date.now();

    db.prepare(`
      INSERT INTO assets (id, name, category, asset_path, mime_type, size, featured, visibility, tags, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(crypto.randomUUID(), request.body.name, request.body.category, request.body.asset_path || '',
      request.body.mime_type, request.body.size || null, request.body.featured ? 1 : 0,
      request.body.visibility ? 1 : 0, JSON.stringify(request.body.tags || []),
      request.body.sort_order || 0, Date.now(), Date.now());

    const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(crypto.randomUUID());
    return reply.status(201).send({ success: true, data: asset });
  });

  fastify.patch('/admin/:id', async (request, reply) => {
    const updates = Object.entries(request.body).filter(([, v]) => v !== undefined);
    if (!updates.length) return reply.status(400).send({ success: false, error: 'No updates', code: 'NO_UPDATES' });

    const fields = Object.keys(request.body).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(request.body), Date.now(), request.params.id];
    db.prepare(`UPDATE assets SET ${Object.keys(request.body).map(k => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`).run(...Object.values(request.body), Date.now(), request.params.id);

    const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(request.params.id);
    return { success: true, data: asset };
  });

  fastify.delete('/admin/:id', { preHandler: [authenticate, requireRole('admin')] }, async (request, reply) => {
    const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(request.params.id);
    if (!asset) return fastify.httpErrors.notFound('Asset not found');

    // Delete physical file
    try {
      const filePath = path.join(process.env.UPLOAD_DIR || './uploads', asset.asset_path);
      await unlink(filePath);
    } catch {}

    db.prepare('DELETE FROM assets WHERE id = ?').run(request.params.id);
    return { success: true, message: 'Asset deleted' };
  });
}