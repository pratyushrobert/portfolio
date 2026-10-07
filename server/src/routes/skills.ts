import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { validateBody, validateParams } from '../middleware/validation.js';
import { idParamSchema, skillCreateSchema, skillUpdateSchema } from '../schemas/index.js';
import type { RouteContext } from './context.js';
import { publicSkill } from './context.js';

type SkillInput = {
  name: string;
  category: string;
  level?: string | null;
  sort_order: number;
  visibility: boolean;
};

function updateValues(body: Record<string, unknown>): { assignments: string[]; values: unknown[] } {
  const allowed = new Set(['name', 'category', 'level', 'sort_order', 'visibility']);
  const assignments: string[] = [];
  const values: unknown[] = [];
  for (const [key, value] of Object.entries(body)) {
    if (allowed.has(key)) {
      assignments.push(`${key} = ?`);
      values.push(key === 'visibility' ? (value ? 1 : 0) : value);
    }
  }
  return { assignments, values };
}

export async function skillRoutes(fastify: FastifyInstance, context: RouteContext): Promise<void> {
  fastify.get('/', async () => {
    const rows = context.database.prepare('SELECT * FROM skills WHERE visibility = 1 ORDER BY category, sort_order, name').all() as Array<Record<string, unknown>>;
    return { success: true, data: rows.map(publicSkill) };
  });
}

export async function skillAdminRoutes(fastify: FastifyInstance, context: RouteContext): Promise<void> {
  const admin = authenticate(context.authService);
  fastify.get('/', { preHandler: [admin] }, async () => {
    const rows = context.database.prepare('SELECT * FROM skills ORDER BY category, sort_order, name').all() as Array<Record<string, unknown>>;
    return { success: true, data: rows.map(publicSkill) };
  });

  fastify.post('/', {
    preHandler: [admin],
    preValidation: [validateBody(skillCreateSchema)],
    handler: async (request, reply) => {
      const data = request.body as SkillInput;
      const id = randomUUID();
      const now = Date.now();
      context.database.prepare(`
        INSERT INTO skills (id, name, category, level, sort_order, visibility, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, data.name, data.category, data.level ?? null, data.sort_order, data.visibility ? 1 : 0, now, now);
      const row = context.database.prepare('SELECT * FROM skills WHERE id = ?').get(id) as Record<string, unknown>;
      return reply.status(201).send({ success: true, data: publicSkill(row) });
    },
  });

  fastify.patch('/:id', {
    preHandler: [admin],
    preValidation: [validateParams(idParamSchema), validateBody(skillUpdateSchema)],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const { assignments, values } = updateValues(request.body as Record<string, unknown>);
      if (assignments.length === 0) {
        return reply.status(400).send({ success: false, error: 'No fields to update', code: 'NO_UPDATES' });
      }
      values.push(Date.now(), id);
      const result = context.database.prepare(`UPDATE skills SET ${assignments.join(', ')}, updated_at = ? WHERE id = ?`).run(...values);
      if (result.changes === 0) {
        return reply.status(404).send({ success: false, error: 'Skill not found', code: 'NOT_FOUND' });
      }
      return { success: true, data: publicSkill(context.database.prepare('SELECT * FROM skills WHERE id = ?').get(id) as Record<string, unknown>) };
    },
  });

  fastify.delete('/:id', {
    preHandler: [admin],
    preValidation: [validateParams(idParamSchema)],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const result = context.database.prepare('DELETE FROM skills WHERE id = ?').run(id);
      if (result.changes === 0) {
        return reply.status(404).send({ success: false, error: 'Skill not found', code: 'NOT_FOUND' });
      }
      return reply.send({ success: true, message: 'Skill deleted' });
    },
  });
}
