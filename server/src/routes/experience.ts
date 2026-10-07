import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { validateBody, validateParams } from '../middleware/validation.js';
import { experienceCreateSchema, experienceUpdateSchema, idParamSchema } from '../schemas/index.js';
import type { RouteContext } from './context.js';
import { publicExperience } from './context.js';

type ExperienceInput = {
  organization: string;
  role: string;
  start_date: string;
  end_date?: string | null;
  description: string;
  technologies: string[];
  link?: string | null;
  sort_order: number;
  visibility: boolean;
};

function updateValues(body: Record<string, unknown>): { assignments: string[]; values: unknown[] } {
  const allowed = new Set(['organization', 'role', 'start_date', 'end_date', 'description', 'technologies', 'link', 'sort_order', 'visibility']);
  const assignments: string[] = [];
  const values: unknown[] = [];
  for (const [key, value] of Object.entries(body)) {
    if (allowed.has(key)) {
      assignments.push(`${key} = ?`);
      values.push(key === 'technologies' ? JSON.stringify(value) : key === 'visibility' ? (value ? 1 : 0) : value);
    }
  }
  return { assignments, values };
}

export async function experienceRoutes(fastify: FastifyInstance, context: RouteContext): Promise<void> {
  fastify.get('/', async () => {
    const rows = context.database.prepare('SELECT * FROM experience WHERE visibility = 1 ORDER BY sort_order, start_date DESC').all() as Array<Record<string, unknown>>;
    return { success: true, data: rows.map(publicExperience) };
  });
}

export async function experienceAdminRoutes(fastify: FastifyInstance, context: RouteContext): Promise<void> {
  const admin = authenticate(context.authService);
  fastify.get('/', { preHandler: [admin] }, async () => {
    const rows = context.database.prepare('SELECT * FROM experience ORDER BY sort_order, start_date DESC').all() as Array<Record<string, unknown>>;
    return { success: true, data: rows.map(publicExperience) };
  });

  fastify.post('/', {
    preHandler: [admin],
    preValidation: [validateBody(experienceCreateSchema)],
    handler: async (request, reply) => {
      const data = request.body as ExperienceInput;
      const id = randomUUID();
      const now = Date.now();
      context.database.prepare(`
        INSERT INTO experience (id, organization, role, start_date, end_date, description, technologies, link, sort_order, visibility, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, data.organization, data.role, data.start_date, data.end_date ?? null, data.description, JSON.stringify(data.technologies), data.link ?? null,
        data.sort_order, data.visibility ? 1 : 0, now, now);
      return reply.status(201).send({ success: true, data: publicExperience(context.database.prepare('SELECT * FROM experience WHERE id = ?').get(id) as Record<string, unknown>) });
    },
  });

  fastify.patch('/:id', {
    preHandler: [admin],
    preValidation: [validateParams(idParamSchema), validateBody(experienceUpdateSchema)],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const { assignments, values } = updateValues(request.body as Record<string, unknown>);
      if (assignments.length === 0) {
        return reply.status(400).send({ success: false, error: 'No fields to update', code: 'NO_UPDATES' });
      }
      values.push(Date.now(), id);
      const result = context.database.prepare(`UPDATE experience SET ${assignments.join(', ')}, updated_at = ? WHERE id = ?`).run(...values);
      if (result.changes === 0) {
        return reply.status(404).send({ success: false, error: 'Experience not found', code: 'NOT_FOUND' });
      }
      return { success: true, data: publicExperience(context.database.prepare('SELECT * FROM experience WHERE id = ?').get(id) as Record<string, unknown>) };
    },
  });

  fastify.delete('/:id', {
    preHandler: [admin],
    preValidation: [validateParams(idParamSchema)],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      const result = context.database.prepare('DELETE FROM experience WHERE id = ?').run(id);
      if (result.changes === 0) {
        return reply.status(404).send({ success: false, error: 'Experience not found', code: 'NOT_FOUND' });
      }
      return reply.send({ success: true, message: 'Experience deleted' });
    },
  });
}
