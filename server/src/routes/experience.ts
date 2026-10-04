import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const experienceSchema = z.object({
  organization: z.string().min(1).max(200),
  role: z.string().min(1).max(100),
  start_date: z.string().regex(/^\d{4}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}$/).nullable().optional(),
  description: z.string().max(2000).optional(),
  technologies: z.array(z.string()).default([]),
  link: z.string().url().nullable().optional(),
  sort_order: z.number().int().min(0).default(0),
  visibility: z.boolean().default(true),
});

export async function experienceRoutes(fastify: FastifyInstance) {
  fastify.get('/', async (request, reply) => {
    const experience = db.prepare('SELECT * FROM experience WHERE visibility = 1 ORDER BY sort_order, start_date DESC').all();
    return { success: true, data: experience };
  });

  fastify.get('/admin', { preHandler: [authenticate, requireRole('admin')] }, async (request, reply) => {
    const experience = db.prepare('SELECT * FROM experience ORDER BY sort_order, start_date DESC').all();
    return { success: true, data: experience };
  });

  fastify.post('/admin', { preHandler: [authenticate, requireRole('admin')] }, async (request, reply) => {
    const id = crypto.randomUUID();
    const now = Date.now();
    const { organization, role, start_date, end_date, description, technologies, link, sort_order, visibility } = request.body as any;

    db.prepare(`
      INSERT INTO experience (id, organization, role, start_date, end_date, description, technologies, link, sort_order, visibility, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(crypto.randomUUID(), request.body.organization, request.body.role, request.body.start_date, request.body.end_date || null,
      request.body.description || null, JSON.stringify(request.body.technologies || []), request.body.link || null,
      request.body.sort_order || 0, request.body.visibility ? 1 : 0, Date.now(), Date.now());

      const exp = db.prepare('SELECT * FROM experience WHERE id = ?').get(crypto.randomUUID());
      return reply.status(201).send({ success: true, data: exp });
    }
  });

  fastify.patch('/admin/:id', { preHandler: [authenticate, requireRole('admin')] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const updates = Object.entries(request.body).filter(([, v]) => v !== undefined);
    if (!updates.length) return reply.status(400).send({ success: false, error: 'No updates', code: 'NO_UPDATES' });

    const fields = Object.keys(request.body).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(request.body), Date.now(), request.params.id];
    db.prepare(`UPDATE experience SET ${Object.keys(request.body).map(k => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`).run(...Object.values(request.body), Date.now(), request.params.id);

    const exp = db.prepare('SELECT * FROM experience WHERE id = ?').get(request.params.id);
    return { success: true, data: exp };
  });

  fastify.delete('/admin/:id', { preHandler: [authenticate, requireRole('admin')] }, async (request, reply) => {
    const result = db.prepare('DELETE FROM experience WHERE id = ?').run(request.params.id);
    if (!result.changes) return fastify.httpErrors.notFound('Experience not found');
    return { success: true, message: 'Experience deleted' };
  });
}