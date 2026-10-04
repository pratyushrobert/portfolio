import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/index.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validateBody, validateParams } from '../middleware/validation.js';
import { z } from 'zod';

const skillSchema = z.object({
  name: z.string().min(1).max(100),
  category: z.enum(['programming', 'cybersecurity', 'web', 'tools', 'infrastructure', 'databases', 'other']),
  level: z.enum(['beginner', 'intermediate', 'advanced', 'expert']).optional(),
  sort_order: z.number().int().min(0).default(0),
  visibility: z.boolean().default(true),
});

const skillUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  category: z.enum(['programming', 'cybersecurity', 'web', 'tools', 'infrastructure', 'databases', 'other']).optional(),
  level: z.enum(['beginner', 'intermediate', 'advanced', 'expert']).optional(),
  sort_order: z.number().int().min(0).optional(),
  visibility: z.boolean().optional(),
});

const skillParamsSchema = z.object({ id: z.string().uuid() });

export async function skillRoutes(fastify: FastifyInstance) {
  fastify.get('/', async (request, reply) => {
    const skills = db.prepare('SELECT * FROM skills WHERE visibility = 1 ORDER BY category, sort_order, name').all();
    return { success: true, data: skills };
  });

  fastify.get('/admin', {
    preHandler: [authenticate, requireRole('admin')],
    handler: async (request, reply) => {
      const skills = db.prepare('SELECT * FROM skills ORDER BY category, sort_order, name').all();
      return { success: true, data: skills };
    }
  });

  fastify.post('/admin', {
    preHandler: [authenticate, requireRole('admin')],
    schema: { body: skillSchema.shape },
    preValidation: [validateBody(z.object(skillSchema.shape))],
    handler: async (request, reply) => {
      const id = crypto.randomUUID();
      const now = Date.now();
      const { name, category, level, sort_order, visibility } = request.body as any;

      db.prepare(`
        INSERT INTO skills (id, name, category, level, sort_order, visibility, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(crypto.randomUUID(), request.body.name, request.body.category, request.body.level || 'intermediate', request.body.sort_order || 0, request.body.visibility ? 1 : 0, Date.now(), Date.now());

      const skill = db.prepare('SELECT * FROM skills WHERE id = ?').get(crypto.randomUUID());
      return reply.status(201).send({ success: true, data: skill });
    }
  });

  fastify.patch('/admin/:id', {
    preHandler: [authenticate, requireRole('admin')],
    schema: { params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } }, required: ['id'] } },
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const updates = Object.entries(request.body).filter(([, v]) => v !== undefined);
      if (updates.length === 0) return reply.status(400).send({ success: false, error: 'No updates provided', code: 'NO_UPDATES' });

      const fields = Object.keys(request.body).map(key => `${key} = ?`).join(', ');
      const values = [...Object.values(request.body), Date.now(), request.params.id];
      db.prepare(`UPDATE skills SET ${updates.map(k => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`).run(...Object.values(request.body), Date.now(), request.params.id);

      const skill = db.prepare('SELECT * FROM skills WHERE id = ?').get(request.params.id);
      return { success: true, data: skill };
    }
  });

  fastify.delete('/admin/:id', {
    preHandler: [authenticate, requireRole('admin')],
    handler: async (request, reply) => {
      const result = db.prepare('DELETE FROM skills WHERE id = ?').run(request.params.id);
      if (result.changes === 0) return fastify.httpErrors.notFound('Skill not found');
      return { success: true, message: 'Skill deleted' };
    }
  });
}