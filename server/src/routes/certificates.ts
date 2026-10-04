import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const certificateSchema = z.object({
  name: z.string().min(1).max(200),
  issuer: z.string().min(1).max(200),
  date: z.string().regex(/^\d{4}-\d{2}$/),
  description: z.string().max(1000).optional(),
  asset_id: z.string().uuid().nullable().optional(),
  link: z.string().url().nullable().optional(),
  sort_order: z.number().int().min(0).default(0),
  visibility: z.boolean().default(true),
});

export async function certificateRoutes(fastify: FastifyInstance) {
  fastify.get('/', async (request, reply) => {
    const certificates = db.prepare('SELECT * FROM certificates WHERE visibility = 1 ORDER BY sort_order, date DESC').all();
    return { success: true, data: certificates };
  });

  fastify.get('/admin', { preHandler: [authenticate, requireRole('admin')] }, async (request, reply) => {
    const certificates = db.prepare('SELECT * FROM certificates ORDER BY sort_order, date DESC').all();
    return { success: true, data: certificates };
  });

  fastify.post('/admin', { preHandler: [authenticate, requireRole('admin')] }, async (request, reply) => {
    const { name, issuer, date, description, asset_id, link, sort_order, visibility } = request.body as any;
    db.prepare(`
      INSERT INTO certificates (id, name, issuer, date, description, asset_id, link, sort_order, visibility, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(crypto.randomUUID(), request.body.name, request.body.issuer, request.body.date,
      request.body.description || null, request.body.asset_id || null, request.body.link || null,
      request.body.sort_order || 0, request.body.visibility ? 1 : 0, Date.now(), Date.now());

    const cert = db.prepare('SELECT * FROM certificates WHERE id = ?').get(crypto.randomUUID());
    return reply.status(201).send({ success: true, data: cert });
  });

  fastify.patch('/admin/:id', { preHandler: [authenticate, requireRole('admin')] }, async (request, reply) => {
    const updates = Object.entries(request.body).filter(([, v]) => v !== undefined);
    if (!updates.length) return reply.status(400).send({ success: false, error: 'No updates', code: 'NO_UPDATES' });

    const fields = Object.keys(request.body).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(request.body), Date.now(), request.params.id];
    db.prepare(`UPDATE certificates SET ${Object.keys(request.body).map(k => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`).run(...Object.values(request.body), Date.now(), request.params.id);

    const cert = db.prepare('SELECT * FROM certificates WHERE id = ?').get(request.params.id);
    return { success: true, data: cert };
  });

  fastify.delete('/admin/:id', { preHandler: [authenticate, requireRole('admin')] }, async (request, reply) => {
    const result = db.prepare('DELETE FROM certificates WHERE id = ?').run(request.params.id);
    if (!result.changes) return fastify.httpErrors.notFound('Certificate not found');
    return { success: true, message: 'Certificate deleted' };
  });
}